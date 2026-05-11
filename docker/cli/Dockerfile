FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/cli/tsconfig.json ./apps/cli/tsconfig.json

RUN npm ci

COPY apps/cli ./apps/cli

RUN npm run build --workspace @aegis/cli

ENTRYPOINT ["node", "apps/cli/dist/index.js"]
