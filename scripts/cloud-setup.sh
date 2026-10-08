#!/usr/bin/env bash
# Script di setup per l'environment di Claude Code sul web.
# Il progetto non ha lockfile versionati (sono nel .gitignore): si usa "npm install".
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "== Dipendenze (root, server, client)"
npm install --no-audit --no-fund
npm --prefix server install --no-audit --no-fund
npm --prefix client install --no-audit --no-fund

# Browser Playwright: solo se il progetto usa Playwright (oggi non lo usa).
if grep -qs '"@playwright/test"' package.json client/package.json server/package.json; then
  echo "== Browser Playwright"
  if [ -d /opt/pw-browsers ]; then
    echo "Chromium gia' presente in /opt/pw-browsers: nessun download."
  else
    npx --prefix client playwright install --with-deps chromium
  fi
fi

echo "Setup completato."
