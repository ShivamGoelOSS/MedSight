# install all dependencies
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# generate Prisma client and build Next.js
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# keep only production dependencies
FROM deps AS prod-deps
RUN npm prune --omit=dev

# final runtime image
FROM node:24-bookworm-slim AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=${APP_VERSION} \
    PORT=3000
WORKDIR /app
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/app/generated ./app/generated
COPY package.json next.config.js prisma.config.ts ./
COPY prisma ./prisma
COPY observability ./observability
USER node
EXPOSE 3000 9464
CMD ["node", "--require", "./observability/otel.js", "node_modules/next/dist/bin/next", "start"]