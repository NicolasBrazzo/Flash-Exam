#!/usr/bin/env bash
# Gate automatici del progetto. Unico punto di verita' per hook, loop agentico e CI.
#
# Uso: bash scripts/gates.sh <lint|typecheck|build|test|e2e|quick|all>
#   lint       ESLint del client (l'unico linter configurato)
#   typecheck  il progetto e' in JavaScript: controllo di sintassi (node --check) sul server;
#              non esiste un typecheck vero e proprio
#   build      vite build del client
#   test       script "test" di client/ e server/, se presente (oggi non ne esistono)
#   e2e        script "test:e2e" del client, se presente (oggi non esiste)
#   quick      lint + typecheck (usato dall'hook dopo ogni modifica)
#   all        lint + typecheck + build + test + e2e
#
# Exit code: 0 ok, 2 gate fallito (il codice 2 fa tornare l'output a Claude negli hook).

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

# L'hook Stop passa il payload JSON su stdin: se un precedente hook Stop ha gia' fatto
# ripartire Claude, non rilanciare per non entrare in un ciclo infinito.
if [ ! -t 0 ] && [ "${1:-}" = "test" ] && grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' 2>/dev/null; then
  exit 0
fi

fail() { echo "GATE FALLITO: $1" >&2; exit 2; }

need_deps() {
  if [ ! -d "$ROOT/$1/node_modules" ]; then
    echo "Dipendenze di $1/ non installate (esegui scripts/cloud-setup.sh): gate saltato." >&2
    return 1
  fi
}

gate_lint() {
  need_deps client || return 0
  echo "== lint (client)"
  npm --prefix client run lint --silent || fail "lint"
}

gate_typecheck() {
  echo "== typecheck"
  local f
  while IFS= read -r -d '' f; do
    node --check "$f" || fail "sintassi non valida in $f"
  done < <(find server -name '*.js' -not -path '*/node_modules/*' -print0)
}

gate_build() {
  need_deps client || return 0
  echo "== build (client)"
  npm --prefix client run build --silent || fail "build"
}

gate_test() {
  echo "== test"
  # --if-present: nessun errore finche' non viene aggiunto un test runner
  if need_deps client; then npm --prefix client run test --if-present || fail "test client"; fi
  if need_deps server; then npm --prefix server run test --if-present || fail "test server"; fi
}

gate_e2e() {
  need_deps client || return 0
  echo "== e2e"
  npm --prefix client run test:e2e --if-present || fail "e2e"
}

case "${1:-all}" in
  lint) gate_lint ;;
  typecheck) gate_typecheck ;;
  build) gate_build ;;
  test) gate_test ;;
  e2e) gate_e2e ;;
  quick) gate_lint; gate_typecheck ;;
  all) gate_lint; gate_typecheck; gate_build; gate_test; gate_e2e ;;
  *) echo "Uso: $0 <lint|typecheck|build|test|e2e|quick|all>" >&2; exit 1 ;;
esac
echo "Gate '${1:-all}' superati."
