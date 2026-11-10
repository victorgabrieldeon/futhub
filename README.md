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

PostgreSQL, API, painel e MinIO não publicam portas próprias. Caddy publica somente loopback:

```bash
http://admin.futhub.localhost
http://api.futhub.localhost
http://s3.futhub.localhost
http://s3console.futhub.localhost
```

Abra painel Tilt para logs e estado dos resources. `discord-bot` inicia manualmente pelo painel depois de preencher `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` em `.env`.

Ao iniciar, o bot sobe para a aplicação do Discord os emojis de `apps/discord-bot/assets/emojis/*.svg` que ainda não existirem; eles aparecem no painel em **Emojis do bot**. No código, use `EMOJI.<nome>` de `apps/discord-bot/src/core/emojis.ts`. Para publicar sem subir o bot, ou recriar após editar um SVG:

```bash
pnpm --filter @futhub/discord-bot emojis:sync           # cria os que faltam
pnpm --filter @futhub/discord-bot emojis:sync --force   # recria todos
pnpm --filter @futhub/discord-bot emojis:sync --preview # PNGs em apps/discord-bot/.emoji-preview
```

Novo emoji: adicione `assets/emojis/<nome>.svg` (128×128) e a entrada em `EMOJI_FALLBACK`.

Times, coleções e packs com imagem também viram emojis da aplicação (`tm_*`, `col_*`, `pk_*`): a API cria ou troca o emoji ao salvar a imagem no painel e apaga junto com o cadastro. O vínculo fica em `discord_emoji`, e o bot recebe esse emoji no lugar do unicode. Ao iniciar, a API faz o retroativo dos cadastros sem emoji, com imagem alterada ou cujo emoji sumiu do Discord; precisa de `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` no ambiente da API.

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
