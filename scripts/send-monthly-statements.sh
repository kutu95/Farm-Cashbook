#!/bin/bash
# Sends statements through the end of the previous month.
# Installed to run at 08:00 Australia/Sydney on the 3rd.
set -euo pipefail
cd /home/john/apps/cashbook

secret=$(sed -n 's/^STATEMENT_CRON_SECRET=//p' .env.production | head -n 1 | tr -d '\r"'"'"'')
if [ -z "${secret}" ]; then
  echo "STATEMENT_CRON_SECRET is missing"
  exit 1
fi

curl -fsS -X POST \
  -H "Authorization: Bearer ${secret}" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/send-monthly-statements
echo
