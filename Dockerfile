# syntax=docker/dockerfile:1

# ---- deps: full dependency install (native better-sqlite3 build needs dev tooling) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: generate Prisma client and compile Next.js ----
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---- prod-deps: drop devDependencies ----
FROM deps AS prod-deps
RUN npm prune --omit=dev

# ---- runtime: minimal, non-root, no package manager ----
FROM node:24-bookworm-slim AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=${APP_VERSION} \
    PORT=3000
WORKDIR /app
# Apply Debian security patches; npm/npx are not needed at runtime, so remove them.
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn*
COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/.next ./.next
COPY --from=build --chown=root:root /app/app/generated ./app/generated
COPY --chown=root:root package.json next.config.js prisma.config.ts ./
COPY --chown=root:root prisma ./prisma
COPY --chown=root:root observability ./observability
# Files are root-owned and read-only to the app user; writable paths are volumes.
USER node
EXPOSE 3000 9464
CMD ["node", "--require", "./observability/otel.js", "node_modules/next/dist/bin/next", "start"]
