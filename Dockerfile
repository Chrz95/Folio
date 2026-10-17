# syntax=docker/dockerfile:1
# Exact release tags; release engineering must supply verified digest-pinned values through these args.
ARG NODE_IMAGE=node:24.19.0-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28.2-alpine
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION=11.25.0
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
FROM base AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store
FROM dependencies AS production-dependencies
RUN pnpm prune --prod
FROM dependencies AS backend-build
COPY tsconfig.base.json ./
COPY backend ./backend
COPY scripts ./scripts
RUN pnpm build:backend
FROM dependencies AS frontend-build
COPY tsconfig.base.json ./
COPY frontend ./frontend
COPY scripts/cleanFrontend.mjs ./scripts/cleanFrontend.mjs
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DEMO_MODE=false
RUN pnpm build:frontend
FROM ${NODE_IMAGE} AS backend
ARG SOURCE_URL=local-folio-source
ARG REVISION=development
ARG VERSION=1.0.0
LABEL org.opencontainers.image.source=${SOURCE_URL} org.opencontainers.image.revision=${REVISION} org.opencontainers.image.version=${VERSION}
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV DATABASE_FILE_PATH=/app/data/app.sqlite
COPY --from=production-dependencies --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=backend-build --chown=1000:1000 /app/backend/dist ./backend/dist
COPY --chown=1000:1000 package.json ./
RUN mkdir -p /app/data && chown 1000:1000 /app/data && chmod 700 /app/data
USER 1000:1000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "backend/dist/server.js"]
FROM backend AS migrate
HEALTHCHECK NONE
CMD ["node", "backend/dist/db/migrate.js"]
FROM ${NGINX_IMAGE} AS frontend
ARG SOURCE_URL=local-folio-source
ARG REVISION=development
ARG VERSION=1.0.0
LABEL org.opencontainers.image.source=${SOURCE_URL} org.opencontainers.image.revision=${REVISION} org.opencontainers.image.version=${VERSION}
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
# nginx-unprivileged uses UID 101; static content never needs to be writable.
USER 101:101
