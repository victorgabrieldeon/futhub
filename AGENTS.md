# Testes E2E

- Testes E2E da API DEVEM usar `apps/api/src/test/e2e/context.ts` para subir PostgreSQL, aplicar migrations, inicializar Nest e encerrar recursos.
- Fixtures de banco DEVEM ficar em `apps/api/src/test/e2e/entities.ts`; testes não devem repetir setup de entidades.
- Testes E2E DEVEM cobrir requisição HTTP e estado persistido observável.
- `apps/api/vite.config.ts` DEVE manter `fileParallelism: false` e `isolate: true`: `DATABASE_URL` e pool PostgreSQL são globais por processo.
