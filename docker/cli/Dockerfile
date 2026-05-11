FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json tsconfig.json ./
COPY apps/cli/package.json ./apps/cli/package.json

RUN npm install

COPY apps/cli ./apps/cli

RUN npm run build --workspace @aegis/cli

ENTRYPOINT ["node", "apps/cli/dist/index.js"]
