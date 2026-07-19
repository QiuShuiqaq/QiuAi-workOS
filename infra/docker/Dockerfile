FROM node:20-alpine AS build

WORKDIR /workspace

RUN apk add --no-cache libc6-compat

COPY . .

RUN npm ci
RUN npm run prisma:generate -w @qiuai/server
RUN npm run build

FROM build AS server

ENV NODE_ENV=production
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=4000

EXPOSE 4000

CMD ["node", "apps/server/dist/main.js"]

FROM build AS web

ENV NODE_ENV=production
ENV SERVER_INTERNAL_BASE_URL=http://server:4000
ENV SERVER_API_BASE_URL=http://server:4000

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web-console", "--hostname", "0.0.0.0", "--port", "3000"]
