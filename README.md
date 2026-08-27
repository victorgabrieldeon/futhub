# FutHub

Sistema de futebol para criar times e disputar ligas.

> Documentação: [victorgabrieldeon.github.io/futhub](https://victorgabrieldeon.github.io/futhub/)

## Stack

- Node.js 22 + TypeScript strict
- pnpm workspaces + Turborepo
- Fastify para API e proxy do painel
- Vite + React Router DOM para painel administrativo
- Discord.js para bot
- PostgreSQL + Drizzle ORM
- Biome para formatação e lint
- Vitest para testes

## Estrutura

```text
apps/
  api/          API HTTP
  admin/        Painel administrativo
  discord-bot/  Bot Discord
packages/
  config/       Configurações TypeScript compartilhadas
  database/     Schema, migrations e cliente Drizzle
  design-system/ Tokens e primitivas visuais compartilhadas
```

## Desenvolvimento local

Pré-requisitos: Docker e [Tilt](https://docs.tilt.dev/install.html). Node.js e dependências JavaScript ficam dentro da imagem de desenvolvimento; não é preciso executar `pnpm install` para subir ambiente.

```bash
corepack enable
pnpm dev:tilt
```

`Tiltfile` cria `.env` a partir de `.env.example` quando necessário e gera `API_INTERNAL_TOKEN` local. Sobe PostgreSQL, aplica migrations e inicia API. Mudanças em `apps/` e `packages/` são sincronizadas no container; API recompila em modo watch.

PostgreSQL não publica porta no host. API recebe porta livre automaticamente, evitando colisão. URL atual:

```bash
docker compose -f docker-compose.yml -f docker-compose.tilt.yml port api 3000
```

Abra painel Tilt para logs e estado dos resources. `discord-bot` inicia manualmente pelo painel depois de preencher `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` em `.env`.

Para encerrar:

```bash
pnpm dev:tilt:down
```

## Comandos

```bash
pnpm dev:tilt
pnpm dev:tilt:down
pnpm check
pnpm format
pnpm build
pnpm test
pnpm --filter @futhub/database db:generate
pnpm --filter @futhub/database db:migrate
```

## Em público

- [Roadmap](ROADMAP.md): direção e prioridades atuais.
- [Contribuir](CONTRIBUTING.md): ambiente local, testes e pull requests.
- [Código de conduta](CODE_OF_CONDUCT.md): espaço respeitoso para comunidade.
- [Segurança](SECURITY.md): reporte privado de vulnerabilidades.

## Licença

[MIT](LICENSE).
