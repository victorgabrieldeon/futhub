# syntax=docker/dockerfile:1.7
FROM node:24-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN corepack enable && pnpm fetch --frozen-lockfile

COPY . .

RUN pnpm install --offline --frozen-lockfile && pnpm build


