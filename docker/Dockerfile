# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    exiftool \
    wget \
    && rm -rf /var/lib/apt/lists/*

# ---- dev: source is bind-mounted / synced by Compose Watch ----
FROM base AS dev
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- migrate: schema migration only — no app build needed, so it's cheap
# to run before web/worker start regardless of which target the compose
# file is deploying ----
FROM base AS migrate
COPY package.json package-lock.json* ./
RUN npm install
COPY drizzle.config.ts ./
COPY server/db ./server/db
CMD ["npm", "run", "db:migrate"]

# ---- deps: production node_modules only ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ---- build: full install + nuxt build ----
FROM base AS build
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- production web ----
FROM base AS web
ENV NODE_ENV=production
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

# ---- production worker (same build output, different entrypoint) ----
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
RUN npm install -g tsx
CMD ["tsx", "server/jobs/worker.ts"]
