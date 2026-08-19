# Design: XP e recompensas por nível

## Objetivo

Portar progressão de XP e recompensas automáticas por nível do Futverse v2 para Dreamfut. XP será concedido somente após sucesso de `/lucro` e abertura de Pack. Cada ação, progressão e recompensa deve confirmar ou falhar como uma única transação PostgreSQL.

## Escopo

- `/v1/commands/lucro` concede XP após crédito de lucro e antes de persistir o cooldown.
- `POST /v1/packs/:packId/open` concede XP após criar as Cards do Pack e antes de reduzir o Pack do inventário.
- Compra de Pack não concede XP.
- Configuração ausente para `lucro` ou `open_pack` é criada automaticamente com 10 XP.
- Uma recompensa de nível é entregue automaticamente; não haverá resgate pendente.
- Tipos de Item permitidos como recompensa: `card`, `pack`, `balance` e `field`. `premium` fica fora deste recorte.

## Não escopo

- Novos comandos Discord de Pack.
- XP por missões, compra de Pack ou outros eventos.
- Recompensas premium, filas de pendências ou tela administrativa.
- Alteração da curva de XP configurável.

## Modelo de progressão

`usuarios.xp` armazena progresso dentro do nível atual; `usuarios.level` começa em 1. XP necessário para concluir o nível atual usa fórmula da referência:

```text
100 * level^1.5, arredondado para baixo ao múltiplo de 50
```

Quando `xpAtual + xpGanho >= xpNecessario`, jogador sobe nível. O excedente continua no novo nível; um ganho pode atravessar vários níveis. Cada nível cruzado é processado em ordem crescente. A regra `>=` corrige referência Futverse v2, que usa `>` e não sobe ao atingir limite exato.

## Arquitetura e transação

Novo módulo interno `progression` expõe uma concessão compartilhada para repositórios Drizzle existentes. Ele recebe transação ativa, ID do jogador, nome de comando e horário atual; devolve resumo de progressão.

Fluxos de lucro e abertura de Pack mantêm posse da própria transação e chamam módulo antes de retornar sucesso. Não haverá tarefa em background nem segunda transação.

O módulo:

1. adquire advisory lock de progressão por jogador;
2. adquire lock por configuração ausente e cria `command_xp_configs` com 10 XP quando necessário;
3. lê XP e nível atuais;
4. calcula níveis cruzados e atualiza jogador;
5. busca `level_rewards` de cada nível cruzado;
6. concede cada Item e monta resumo;
7. devolve para resposta do comando.

Falha em qualquer passo lança erro e reverte ação original, saldo, Cards do Pack, cooldown, XP, nível, recompensas e histórico. O lock por jogador serializa concorrência entre lucro e abertura de Pack, impedindo perda de XP ou dupla recompensa de nível.

## Entrega de Item

Todo Item deve ter referência compatível com seu tipo e quantidade positiva; configuração inválida falha transação.

- `balance`: soma `amount` a `usuarios.saldo` e insere `transaction_history` de tipo `reward` com valor positivo.
- `card`: exige `card_id`, verifica capacidade antes de inserir `amount` registros em `user_cards`, e marca origem `reward`.
- `pack`: exige `pack_id` e incrementa `user_packs` por upsert.
- `field`: exige `soccer_field_id` e insere em `user_soccer_fields`; campo já possuído não duplica registro e permanece uma recompensa processada.
- `premium`: rejeitado neste fluxo.

Se recompensa de Card exceder `game_settings.max_cards_per_user`, operação inteira falha sem mudança. Jogador deve liberar espaço e tentar ação novamente.

Migração adiciona valor `reward` ao enum `card_claim_origin`; nenhuma tabela nova é necessária.

## Contrato HTTP

Respostas de sucesso de `/lucro` e abertura de Pack incluem `progression`:

```ts
{
  gainedXp: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  rewards: readonly {
    type: 'card' | 'pack' | 'balance' | 'field';
    quantity: number;
    resourceId: string;
  }[];
}
```

Cooldown de `/lucro` não inclui `progression`. Compra de Pack não muda. DTOs e cliente gerado são atualizados. Formatação Discord de `/lucro` exibe resumo de XP e recompensas; abertura de Pack não cria comando Discord novo.

## Testes

- cálculo da curva, limite exato com `>=` e ganho que sobe vários níveis;
- criação concorrente e configuração persistida de 10 XP para cada comando;
- XP configurado customizado;
- recompensa automática dos quatro tipos aceitos;
- campo já possuído sem duplicação;
- cooldown sem concessão de XP;
- rollback completo quando Card de recompensa excede capacidade;
- concorrência entre lucro e abertura de Pack para mesmo jogador;
- resposta HTTP de sucesso com `progression` e cliente/formatação Discord de lucro atualizados.

## Critérios de aceite

- Apenas lucro e abertura de Pack concedem XP.
- Ações simultâneas do mesmo jogador preservam total de XP e concedem cada recompensa de nível no máximo uma vez.
- Recompensas são entregues ou a ação inteira não ocorre.
- Atingir exatamente requisito do nível sobe nível.
- Respostas de sucesso permitem mostrar XP, nível e recompensas entregues ao usuário.
