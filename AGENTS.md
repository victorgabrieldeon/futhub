# Dreamfut Agent Guide

## Toolchain And Checks

- Use Node `>=22.14.0` and pnpm `>=10.6.5` (`packageManager` pins `pnpm@10.6.5`); enable Corepack before the first install.
- Run `pnpm check` before finishing. It runs formatting, lint, typecheck, then tests in that order.
- Scope iteration to a package, for example: `pnpm --filter @dreamfut/api test -- app.test.ts` or `pnpm --filter @dreamfut/api typecheck`.
- Root test and typecheck tasks are Turborepo tasks; tests depend on dependency builds. Biome ignores `dist`, `.turbo`, coverage, and Drizzle migration output.
- TypeScript is strict with `noUncheckedIndexedAccess`, unused checks, NodeNext ESM, and verbatim module syntax. Use `.js` extensions for relative TypeScript imports.

## Runtime And Structure

- `pnpm dev` starts both applications in parallel. The API starts from `apps/api/src/server.ts`; keep Fastify construction and routes in `buildApp` so API tests can use `app.inject` and close the app.
- The Discord bot starts from `apps/discord-bot/src/index.ts` and fails immediately without `DISCORD_TOKEN`.
- `@dreamfut/database` exports TypeScript source and initializes its PostgreSQL pool on import; importing it requires `DATABASE_URL` to already be present.
- Current package scripts do not load `.env`; provide required variables in the process environment. Local PostgreSQL is `docker compose up -d`; its connection URL is documented in `.env.example`.
- Define schema in `packages/database/src/schema.ts`; generate then apply migrations with `pnpm --filter @dreamfut/database db:generate` and `pnpm --filter @dreamfut/database db:migrate`. Both require `DATABASE_URL` and write migrations to `packages/database/drizzle`.

## API Module Structure

- Keep each product module under `apps/api/src/modules/<module>/` with `*.controller.ts`, `*.dto.ts`, `*.module.ts`, `repository/`, and `use-cases/<use-case>/`.
- Controllers only validate and adapt HTTP input/output. Use cases own domain rules, decisions, and orchestration. Drizzle repositories only acquire transaction/locking context and read or write persistence requested through a use-case port.
- Keep use cases framework-free and test their observable rules without Nest or PostgreSQL. Add repository integration tests for SQL, locking, and transaction rollback.

## Repository Rules

- Do not use `any`, type assertions, or non-null assertions without concrete proof.
- Validate API and Discord input at boundaries.
- Database changes require a Drizzle migration. Add a focused test for non-trivial behavior and bug fixes.
- Keep product API routes under `/v1`.
- Never read, log, commit, or expose `.env` values or credentials.
