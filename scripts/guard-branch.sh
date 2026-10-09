#!/usr/bin/env bash
# Hook PreToolUse (Bash): blocca i commit diretti su main/master e sul branch base agents-program.
# Riceve su stdin il payload JSON dell'hook; interviene solo sui comandi "git commit".
INPUT="$(cat)"
echo "$INPUT" | grep -q 'git commit' || exit 0
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ] || [ "$BRANCH" = "agents-program" ]; then
  echo "Commit bloccato: sei su '$BRANCH'. Lavora su un branch dedicato (vedi CLAUDE.md)." >&2
  exit 2
fi
exit 0
