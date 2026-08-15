# Design: centralizar negócio do Discord bot na API NestJS

## Objetivo

Mover regra econômica e persistência do comando `/lucro` do Discord bot para API. API passa a ser fonte única das regras de negócio; bot fica como adapter Discord e consumidor HTTP tipado.

Migrar API atual de Fastify puro para NestJS com `FastifyAdapter`, publicar contrato OpenAPI por Swagger e gerar SDK versionado com Orval em `packages/api-client`.

## Decisões

- NestJS usa `@nestjs/platform-fastify`; Express não entra.
- Organização é vertical por funcionalidade. `LucroModule` contém primeiro fluxo; não haverá executor genérico de comandos.
- Infraestrutura transversal reutilizável limita-se a autenticação, HTTP, Swagger, erros e cliente gerado.
- Comunicação bot–API usa HTTP com Bearer token interno compartilhado.
- Endpoint de produto fica sob `/v1`.
- API retorna dados de domínio estruturados. Formatação específica do Discord permanece no bot.
- Orval lê `openapi.json` gerado sem exigir API em execução.
- SDK gerado fica em `packages/api-client` e é versionado no Git.
- Banco e schema atuais permanecem. Nenhuma migration é necessária para esta movimentação.

## Arquitetura

### API

API passa a iniciar NestJS sobre Fastify. Bootstrap mantém construção separada de inicialização para testes fecharem aplicação corretamente.

`AppModule` compõe:

- configuração HTTP;
- autenticação interna;
- Swagger/OpenAPI;
- tratamento seguro de erros;
- `LucroModule`.

`LucroModule` contém unidades com limites claros:

- controller: valida HTTP e traduz DTOs;
- caso de uso framework-free: aplica cooldown, sorteio e crédito;
- repositório Drizzle: transação, locks e persistência;
- DTOs: contrato Swagger/OpenAPI.

Regra framework-free não importa NestJS, Fastify, Discord ou Drizzle. Repositório implementa porta exigida pelo caso de uso.

### Discord bot

Bot conserva:

- criação do cliente Discord;
- registro e dispatch de slash commands;
- extração da identidade Discord;
- chamada ao SDK;
- formatação de sucesso e cooldown para Discord;
- resposta genérica em falhas.

Bot remove:

- seleção ponderada;
- decisão de cooldown;
- crédito de saldo;
- configuração default do comando;
- transações e queries;
- dependência de `@dreamfut/database`.

### SDK

`packages/api-client` contém configuração Orval e saída gerada. Cliente expõe operação tipada para executar lucro. Código gerado não recebe edição manual.

Fluxo de contrato:

1. decorators e DTOs NestJS descrevem endpoint;
2. script da API gera `openapi.json` de forma determinística;
3. Orval lê arquivo e atualiza SDK;
4. bot compila contra SDK versionado.

Mudança de contrato deve regenerar documento e SDK no mesmo commit.

## Contrato HTTP

### `POST /v1/commands/lucro`

Requer header:

`Authorization: Bearer <API_INTERNAL_TOKEN>`

Body:

```json
{
  "id": "discord-snowflake",
  "name": "nome atual",
  "avatarUrl": "https://cdn.discordapp.com/avatar.png"
}
```

`avatarUrl` aceita `null`. API valida tipos, campos obrigatórios e limites compatíveis com schema do banco. Horário não faz parte da entrada: API usa relógio do servidor.

Resposta `200` é união discriminada por `kind`.

Sucesso:

```json
{
  "kind": "success",
  "reward": {
    "value": 100,
    "weight": 30,
    "message": "Bom lucro: +100"
  },
  "balance": 450,
  "availableAt": "2026-08-15T12:10:00.000Z"
}
```

Cooldown:

```json
{
  "kind": "cooldown",
  "availableAt": "2026-08-15T12:10:00.000Z"
}
```

Datas cruzam HTTP como strings ISO 8601. SDK reflete contrato gerado; bot converte somente quando necessário para formatação Discord.

## Autenticação e exposição

Guard reutilizável valida Bearer token interno em rotas protegidas. Comparação evita vazamento por timing. Token vem de `API_INTERNAL_TOKEN` na API e no bot, nunca aparece em logs, Swagger gerado ou respostas.

Política:

- `POST /v1/commands/lucro`: protegido;
- `GET /health`: público para health checks;
- Swagger UI e documento servido: públicos no ambiente atual, sem dados ou segredos; deploy pode restringi-los na borda sem mudar regra de negócio.

Swagger declara esquema Bearer para permitir testes autorizados sem embutir token.

## Fluxo do lucro

1. controller recebe identidade validada;
2. caso de uso obtém horário do servidor;
3. repositório abre transação e serializa mesmo comando e usuário com advisory lock;
4. usuário é criado ou atualizado por Discord ID;
5. configuração default de `lucro` é criada idempotentemente quando ausente;
6. cooldown persistido é lido;
7. se `now < availableAt`, transação retorna cooldown sem crédito;
8. recompensa é escolhida pelos pesos persistidos;
9. saldo é incrementado atomicamente;
10. próximo horário é persistido;
11. resposta estruturada retorna ao bot.

Uso é permitido quando `now >= availableAt`. Saldo e cooldown mudam na mesma transação; falha causa rollback completo. Concorrência para mesmo usuário e comando concede no máximo uma recompensa por janela.

Defaults, pesos e comportamento econômico permanecem iguais ao design anterior em `docs/superpowers/specs/2026-08-15-lucro-cooldown-design.md`.

## Erros

- token ausente, malformado ou inválido: `401`;
- body inválido: `400`;
- rota inexistente: `404`;
- falha inesperada: `500` com corpo genérico.

API registra contexto operacional sem token nem credenciais. Detalhes de banco e stack não chegam ao cliente. Bot registra falha técnica e responde mensagem efêmera genérica, usando `followUp` quando interação já foi respondida ou adiada.

Sem retentativa automática no `POST`: operação não possui chave de idempotência HTTP. Retentativa cega após timeout poderia executar novo lucro quando primeira resposta se perdeu. Cooldown reduz risco, mas não substitui idempotência.

## Configuração operacional

Variáveis necessárias:

- API: `DATABASE_URL`, `API_INTERNAL_TOKEN`, `API_PORT` opcional;
- bot: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `API_BASE_URL`, `API_INTERNAL_TOKEN`.

Processos falham cedo quando variável obrigatória falta. `.env.example` documenta nomes sem valores secretos.

API precisa estar alcançável pelo bot. Bot não precisa mais alcançar PostgreSQL.

## Testes

### Regra de negócio

Preservar cobertura atual para:

- limites da seleção ponderada com RNG controlado;
- sucesso e novo saldo;
- cooldown ativo;
- uso exatamente em `availableAt`;
- validação de pesos e RNG.

### Persistência

Cobrir:

- criação e atualização de usuário;
- criação idempotente dos defaults;
- crédito e cooldown na mesma transação;
- rollback em falha;
- duas chamadas concorrentes concedendo uma recompensa.

### API

Usar aplicação NestJS com Fastify e injeção HTTP, sem porta real, para verificar:

- health público;
- `401` sem token e com token inválido;
- `400` para identidade inválida;
- respostas de sucesso e cooldown;
- esquema Swagger com endpoint, Bearer auth e união de resposta;
- fechamento da aplicação após testes.

### Bot e SDK

Cobrir adapter com cliente injetado ou mockado:

- identidade correta enviada ao SDK;
- formatação de sucesso;
- formatação de cooldown;
- erro do cliente vira resposta efêmera genérica;
- bot não importa pacote de banco.

Verificação de geração detecta divergência entre DTOs, `openapi.json` e saída Orval versionada. `pnpm check` deve passar.

## Sequência de migração

1. migrar shell HTTP para NestJS com Fastify e preservar health;
2. adicionar guard Bearer e Swagger;
3. mover domínio e repositório de lucro para `LucroModule`;
4. expor endpoint e testes;
5. gerar `openapi.json` e `packages/api-client` via Orval;
6. trocar bot para SDK e manter formatação Discord;
7. remover services e dependência do banco no bot;
8. executar geração limpa e `pnpm check`.

Mudança entra atomicamente: bot não deve depender de endpoint ausente, e API não deve manter duas implementações ativas da regra.

## Fora do escopo

- executor genérico para comandos Discord;
- endpoint dinâmico por nome de comando;
- Express;
- autenticação de usuários finais ou OAuth Discord;
- HMAC, rotação automática de token ou mTLS;
- idempotency keys;
- novos comandos econômicos;
- mudança de schema ou migration;
- mover textos específicos de Discord para API;
- publicar pacote SDK em registry externo.

## Critérios de aceite

- API roda em NestJS com `FastifyAdapter`.
- `POST /v1/commands/lucro` exige Bearer token e valida entrada.
- API decide horário, cooldown, recompensa, saldo e persistência.
- Comportamento econômico e garantias transacionais atuais permanecem.
- Swagger documenta endpoint e autenticação.
- `openapi.json` é gerável sem servidor ativo.
- Orval gera SDK versionado em `packages/api-client`.
- Bot usa SDK, não acessa banco e contém somente lógica de adapter/formatação.
- Código de negócio não depende de NestJS, Fastify, Discord ou Drizzle.
- Falhas não expõem credenciais ou detalhes internos.
- Testes focados e `pnpm check` passam.
