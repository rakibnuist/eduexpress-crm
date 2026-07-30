FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server.js sqldb.js wa-linked.js default_destinations.json ./

RUN mkdir -p /data /app/uploads

EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
