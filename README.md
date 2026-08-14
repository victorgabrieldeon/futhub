# Dreamfut

Sistema de futebol para criar times e disputar ligas.

## Stack

- Node.js 22 + TypeScript strict
- pnpm workspaces + Turborepo
- Fastify para API
- Next.js para o Card Maker
- Discord.js para bot
- PostgreSQL + Drizzle ORM
- Biome para formatação e lint
- Vitest para testes

## Estrutura

```text
apps/
  api/          API HTTP
  card-maker/   Editor e catalogo de bases de cartas
  discord-bot/  Bot Discord
packages/
  config/       Configurações TypeScript compartilhadas
  database/     Schema, migrations e cliente Drizzle
  design-system/ Tokens e primitivas visuais compartilhadas
```

## Primeiro uso

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

## Comandos

```bash
pnpm check
pnpm format
pnpm build
pnpm test
pnpm --filter @dreamfut/database db:generate
pnpm --filter @dreamfut/database db:migrate
```
