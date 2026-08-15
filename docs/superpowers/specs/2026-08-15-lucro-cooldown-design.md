# Design: lucro com cooldown por usuário e comando

## Objetivo

Adicionar `/lucro`, comando Discord que concede recompensa ponderada ao usuário e só pode ser usado novamente após cooldown persistente. Criar domínio reutilizável por outros comandos sem acoplar regras ao Discord.

## Escopo

Incluído:

- primeiro dispatcher de slash commands do bot;
- vínculo estável entre usuário interno e usuário Discord;
- configuração persistente por comando;
- recompensas ponderadas persistentes;
- cooldown persistente por usuário e comando;
- criação automática de usuário e configuração default do `/lucro`;
- incremento atômico de saldo;
- migration Drizzle e testes focados.

Fora do escopo:

- configuração por servidor Discord;
- histórico ou extrato de movimentações;
- painel administrativo;
- cooldown compartilhado entre comandos;
- tabela `cooldown_config` separada;
- regras de recompensa negativas ou dependentes de contexto externo.

## Modelo de dados

### `usuarios`

Adicionar `discord_user_id`, obrigatório e único. O Discord snowflake deve ser armazenado como texto para preservar identidade sem conversão numérica. `nome` e `url_avatar` guardam dados atuais recebidos do Discord.

### `command_config`

Campos:

- `id`;
- `command_name`, único;
- `cooldown_seconds`, inteiro positivo;
- timestamps de criação e atualização.

A duração fica diretamente no comando. `cooldown_config` não será criada porque não há política reutilizável separada.

### `command_reward`

Campos:

- `id`;
- `command_config_id`, chave estrangeira;
- `value`, inteiro positivo;
- `weight`, inteiro positivo;
- `message`, texto obrigatório.

Cada comando pode ter várias recompensas. Peso representa chance relativa, não porcentagem fixa.

### `user_cooldown`

Campos:

- `user_id`, chave estrangeira;
- `command_config_id`, chave estrangeira;
- `available_at`, timestamp com timezone;
- timestamps.

Chave única composta por `user_id` e `command_config_id`. Cooldown não varia por servidor.

## Default do `/lucro`

Se `command_config` para `lucro` não existir, primeira execução cria configuração e recompensas na mesma operação idempotente.

Configuração:

- cooldown: `600` segundos.

Recompensas:

| Valor | Peso | Mensagem |
| ---: | ---: | --- |
| 50 | 50 | `Lucro básico: +50` |
| 100 | 30 | `Bom lucro: +100` |
| 250 | 15 | `Grande lucro: +250` |
| 500 | 4 | `Lucro raro: +500` |
| 1000 | 1 | `Lucro lendário: +1000` |

Criação usa restrição única e tratamento transacional para impedir duplicação sob concorrência.

## Domínio e fluxo transacional

Lib framework-free recebe:

- nome do comando;
- identidade Discord (`id`, nome e avatar);
- horário atual;
- fonte de aleatoriedade injetável para teste.

Fluxo:

1. localizar ou criar usuário por `discord_user_id`;
2. localizar ou criar configuração default do `/lucro`;
3. obter e bloquear registro de cooldown do usuário e comando;
4. se `available_at` for posterior ao horário atual, retornar resultado de cooldown sem alterar saldo;
5. escolher recompensa pela soma dos pesos e um valor aleatório no intervalo correspondente;
6. incrementar `saldo` atomicamente;
7. gravar `available_at = now + cooldown_seconds`;
8. confirmar transação;
9. retornar recompensa, mensagem, novo saldo e próxima disponibilidade.

Limite temporal é inclusivo: uso é permitido quando `now >= available_at`.

Saldo e cooldown mudam na mesma transação. Qualquer falha causa rollback completo. Cooldown começa somente após recompensa concedida com sucesso.

## Concorrência

A chave única garante um cooldown por usuário e comando. Operação deve serializar tentativas concorrentes do mesmo par por bloqueio transacional. Duas execuções simultâneas não podem conceder duas recompensas.

Criação concorrente de usuário, configuração default ou cooldown deve usar constraints como fonte de verdade e repetir apenas leitura necessária após conflito esperado; não deve depender de checagem prévia isolada.

## Adapter Discord

Bot terá separação entre entrada, criação do cliente e dispatch de interação. Adapter valida que interação é slash command conhecido e chama domínio sem conter regra econômica.

`/lucro` envia identidade do usuário e horário atual. Respostas:

- sucesso: mensagem da recompensa, valor concedido, saldo atualizado e próxima disponibilidade;
- cooldown ativo: tempo restante e horário de liberação;
- erro inesperado: mensagem genérica, com detalhe apenas no logger interno e sem credenciais.

Registro/deploy do slash command deve usar `DISCORD_CLIENT_ID` já documentado e mecanismo mínimo compatível com `discord.js`.

## Migração

Schema Drizzle e migrations atuais divergem: schema declara `usuarios`, mas migration inicial cria somente `card_bases` removida.

Antes de gerar nova migration, verificar se migration atual já foi aplicada em ambiente compartilhado:

- se não publicada/aplicada, corrigir linha histórica para representar estado inicial real;
- se aplicada, preservar histórico e criar migration incremental que cria `usuarios`, remove estrutura obsoleta quando seguro e adiciona tabelas desta feature.

Resultado obrigatório: banco criado somente por migrations deve corresponder ao schema TypeScript atual.

Mudanças de banco incluem constraints, índices e chaves estrangeiras necessários. Valores e pesos devem ser positivos; `cooldown_seconds` deve ser positivo.

## Testes

Testes de domínio e persistência devem cobrir:

- seleção ponderada em limites com RNG controlado;
- primeira execução cria usuário e defaults, concede lucro e inicia cooldown;
- nova execução antes de `available_at` não altera saldo;
- execução em ou após `available_at` concede novamente;
- duas execuções concorrentes concedem uma recompensa;
- criação default concorrente não duplica configuração ou recompensas;
- usuário Discord existente é reutilizado e dados mutáveis podem ser atualizados;
- falha entre crédito e cooldown causa rollback completo.

Testes do adapter Discord cobrem dispatch e formatação dos resultados de sucesso e cooldown sem conectar ao Discord real.

`pnpm check` deve passar ao final.

## Critérios de aceite

- `/lucro` cria usuário automaticamente quando necessário.
- Primeira ausência de configuração cria default persistente uma única vez.
- Recompensa respeita pesos configurados no banco.
- Saldo recebe valor sorteado exatamente uma vez.
- Mesmo usuário não reutiliza mesmo comando antes de 600 segundos por default.
- Outros usuários e outros comandos possuem cooldowns independentes.
- Reinício do bot não perde cooldown.
- Concorrência não duplica crédito.
- Regras de negócio não dependem de tipos do Discord.
- Migrations reproduzem schema funcional em banco vazio.
