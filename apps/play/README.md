# FutHub Play

Jogo no navegador e como **Activity do Discord** (mesmo build). Todas as features do bot:
lucro, estádio, resgatar código, loja/packs, elenco (formação, tática, escalação, capitão,
favoritos, venda), mercado, liga/ranqueada, amistoso vs CPU e missões.

## Autenticação

- Web: login OAuth em `/v1/auth/player/discord` (cookie) → `GET /v1/auth/player/session` devolve `token`.
- Activity: detectada por `frame_id` na query. O Embedded App SDK faz `authorize` → `POST /v1/auth/player/activity { code }` → `authenticate`.
- Nos dois casos o front chama as rotas de jogo com `Authorization: Bearer <token>`. A API sobrescreve a identidade do body pela da sessão assinada (`PlayerOrInternalAuthGuard`).

## Configurar a Activity (Discord Developer Portal)

1. **Activities → Settings**: habilitar Activities. O bot registra o Entry Point `/jogar`.
2. **OAuth2 → Redirects**: manter `PLAYER_DISCORD_REDIRECT_URI` (login web). A troca de código da Activity não usa redirect.
3. **Activities → URL Mappings**:

   | Prefixo        | Alvo                                   |
   | -------------- | -------------------------------------- |
   | `/`            | host público do `@futhub/play`         |
   | `/storage`     | host de `MINIO_PUBLIC_URL` (imagens)   |
   | `/discord-cdn` | `cdn.discordapp.com` (avatares)        |

Env da API: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `PLAYER_SESSION_SECRET`,
`PLAYER_DISCORD_REDIRECT_URI`, `PLAYER_APP_URL`.

## Dev local da Activity

```sh
cloudflared tunnel --url http://localhost:3001
PLAYER_ALLOWED_HOSTS=.trycloudflare.com pnpm --filter @futhub/play dev
```

Aponte o mapeamento `/` para o host do túnel.
