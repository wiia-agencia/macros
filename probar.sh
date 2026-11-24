#!/bin/sh
# Monta la app y pasa todas las pruebas: el cálculo, la base de datos de usuarios (en un Postgres dentro de Node),
# el módulo de la cuenta y las de pantalla. Necesita Node, Playwright y Chrome, y haber hecho «npm install» en test/.
# Si una falla, enseña su final y sale con error.
cd "$(dirname "$0")" || exit 1
python3 build.py || exit 1
node --test test/core.test.js test/nube.test.js test/nube-cliente.test.js > /tmp/macros-core.log 2>&1 || { grep -E '^not ok|^# ' /tmp/macros-core.log; exit 1; }
grep -E '^# (tests|pass|fail)' /tmp/macros-core.log
for t in arranque flujo hoy historial peso instalable usuarios; do
  [ -f "test/$t.js" ] || continue
  if node "test/$t.js" > "/tmp/macros-$t.log" 2>&1; then tail -1 "/tmp/macros-$t.log"; else tail -25 "/tmp/macros-$t.log"; exit 1; fi
done
