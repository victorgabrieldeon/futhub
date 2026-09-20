# syntax=docker/dockerfile:1.7
FROM rustfs/rustfs:1.0.0 AS rustfs

FROM node:24-alpine AS build

WORKDIR /app

ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN corepack enable && pnpm fetch --frozen-lockfile

COPY . .

RUN pnpm install --offline --frozen-lockfile \
  && pnpm --filter @futhub/database build \
  && pnpm build

FROM build AS api

ENV NODE_ENV=production

CMD ["sh", "-ec", "pnpm --filter @futhub/database db:migrate && exec node apps/api/dist/server.js"]

FROM build AS admin

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@futhub/admin", "start"]

FROM build AS player

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@futhub/play", "start"]
