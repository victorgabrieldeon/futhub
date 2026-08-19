# Design: packs e inventário

## Objetivo

Entregar compra e abertura de Packs com inventário de Cards, regras transacionais e integração interna API/Discord futura.

## Decisões

- Compra e abertura são casos de uso distintos.
- Cards repetidos são permitidos na mesma abertura.
- Saldo usa moedas inteiras.
- Abertura é atômica: nunca consome Pack ou cria parte das cartas.
- Capacidade de Cards é configuração global singleton.
- RNG e relógio são dependências injetadas.

## Dados

Adicionar `game_settings` singleton com `max_cards_per_user` positivo. Adicionar migration incremental sem alterar Catálogos existentes.

## Comprar Pack

Entrada: identidade Discord e `packId`.

Transação:

1. localizar/criar jogador por identidade Discord;
2. bloquear jogador e Pack;
3. validar Pack disponível, saldo suficiente e quantidade de Cards atual abaixo da capacidade;
4. validar quantidade atual do Pack contra `limit_per_user`;
5. debitar preço;
6. incrementar `user_packs`;
7. gravar `transaction_history` de compra;
8. retornar saldo e quantidade atual.

## Abrir Pack

Entrada: identidade Discord e `packId`.

Transação:

1. localizar jogador e bloquear jogador+Pack;
2. exigir `user_packs.quantity > 0`;
3. validar capacidade para `cards_amount`;
4. aplicar filtros inclusivos/exclusivos do `pack_config`;
5. remover overalls sem candidatos das probabilidades;
6. sortear overall ponderado e Card uniforme dentre candidatos daquele overall, uma vez por slot;
7. permitir que mesmo Card seja escolhido em slots distintos;
8. criar `user_cards` com origem `pack`;
9. decrementar/remover `user_packs`;
10. retornar cards concedidos, quantidade remanescente e saldo inalterado.

Pack mal configurado ou sem candidatos falha antes de qualquer escrita.

## Arquitetura

Novo módulo `packs` segue padrão de `lucro`: controller fino, use case framework-free, portas de repositório e adaptador Drizzle. Repositório contém locks, seleção SQL e escrita transacional. Não há regra econômica no controller ou no bot.

## Testes

- compra debita uma vez e respeita limite;
- compra concorrente não excede limite;
- abertura cria exatamente `cards_amount` e consome um Pack;
- duplicatas são possíveis;
- filtros e pesos selecionam apenas candidatos elegíveis;
- falta de candidatos, Pack ausente, inventário vazio e capacidade excedida fazem rollback;
- requisição API valida corpo e exige autenticação.

## Aceite

Usuário autenticado compra e abre Packs configurados. Todas operações concorrentes preservam saldo, inventário de Packs e Cards sem parcialidade.