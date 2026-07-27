#!/bin/bash
set -e
echo "Building SureComply..."
cd "$(dirname "$0")"
sudo sh -c 'lsof -t -iTCP:3000 -sTCP:LISTEN | xargs -r kill' 2>/dev/null || true
bun run build 2>&1 | tail -5
nohup bun run start > /tmp/surecomply.log 2>&1 &
sleep 3
echo "SureComply published at http://localhost:3000"
