# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/discord-bot/package.json apps/discord-bot/package.json
COPY apps/play/package.json apps/play/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json

RUN corepack enable && pnpm fetch --frozen-lockfile

RUN pnpm install --offline --frozen-lockfile

FROM dependencies AS workspace

COPY . .

FROM workspace AS full

RUN pnpm build

FROM workspace AS admin-build

RUN pnpm --filter @futhub/admin build \
  && pnpm --filter @futhub/admin deploy --prod --legacy /opt/admin

FROM node:24-alpine AS admin

WORKDIR /app

ENV NODE_ENV=production

COPY --from=admin-build /opt/admin ./
