FROM node:24-alpine

WORKDIR /app

COPY . .

RUN corepack enable && pnpm install --frozen-lockfile && pnpm build
