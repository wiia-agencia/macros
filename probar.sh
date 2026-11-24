#!/bin/sh
# Monta la app y pasa todas las pruebas: las del cálculo y las de pantalla (necesitan Node, Playwright y Chrome).
# Si una falla, enseña su final y sale con error.
cd "$(dirname "$0")" || exit 1
python3 build.py || exit 1
node --test test/core.test.js > /tmp/macros-core.log 2>&1 || { grep -E '^not ok|^# ' /tmp/macros-core.log; exit 1; }
grep -E '^# (tests|pass|fail)' /tmp/macros-core.log
for t in arranque flujo hoy historial peso instalable; do
  [ -f "test/$t.js" ] || continue
  if node "test/$t.js" > "/tmp/macros-$t.log" 2>&1; then tail -1 "/tmp/macros-$t.log"; else tail -25 "/tmp/macros-$t.log"; exit 1; fi
done
