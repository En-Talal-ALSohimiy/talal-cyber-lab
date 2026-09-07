#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
command -v docker >/dev/null || { echo 'Install Docker Engine and Compose v2 for Linux first.'; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
umask 077
if [[ ! -f .env ]]; then
  command -v openssl >/dev/null || { echo 'Install openssl first.'; exit 1; }
  printf 'LAB_WORKER_TOKEN=%s\n' "$(openssl rand -hex 32)" > .env
fi
docker compose up --build -d --wait --wait-timeout 180
echo 'Open http://localhost:3210'
echo 'Read your initial password with: docker compose exec app cat /data/initial-password.txt'
echo 'Run the acceptance check with: docker compose exec app node local/acceptance.mjs'

