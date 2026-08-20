#!/bin/sh
# Pull the latest source and rebuild/restart the production stack.
#
# Usage (from the repo root on the host, e.g. Unraid):
#   ./docker/update.sh

set -eu

cd "$(dirname "$0")/.."

git pull
docker compose -f compose.prod.yml up -d --build
