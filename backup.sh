#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
umask 077
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
# Stop database writers before copying SQLite, WAL, credentials and evidence together.
docker compose stop app
trap 'docker compose start app >/dev/null' EXIT
docker compose run --rm --no-deps --entrypoint tar app -czf - -C /data . > "backups/talal-${stamp}.tar.gz"
test -s "backups/talal-${stamp}.tar.gz"
echo "Backup created: backups/talal-${stamp}.tar.gz (contains sensitive data and account credentials)"

