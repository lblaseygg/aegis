FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY config ./config
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/cli/tsconfig.json ./apps/cli/tsconfig.json
COPY docker/cli/entrypoint.sh /usr/local/bin/aegis-entrypoint

RUN npm ci

COPY apps/cli ./apps/cli

RUN npm run build --workspace @aegis/cli
RUN chmod +x /usr/local/bin/aegis-entrypoint

ENTRYPOINT ["aegis-entrypoint"]
