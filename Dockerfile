FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS app
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist-local ./dist-local
COPY lib ./lib
COPY local ./local
COPY drizzle ./drizzle
RUN mkdir /data && chown node:node /data
USER node
ENV LAB_DATA=/data LAB_BIND=0.0.0.0
EXPOSE 3210
CMD ["node","local/server.mjs"]

FROM node:24-bookworm-slim AS worker
# Packages are installed by the end user from Debian repositories at build time.
# This repository does not redistribute vendor executables or OS images.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends file libimage-exiftool-perl poppler-utils sleuthkit tshark ssdeep yara nmap ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY local/worker.mjs local/engine.mjs local/profiles.mjs ./local/
COPY rules /opt/lab/rules
USER node
ENV WORKER_HOST=0.0.0.0
EXPOSE 3211
CMD ["node","local/worker.mjs"]

