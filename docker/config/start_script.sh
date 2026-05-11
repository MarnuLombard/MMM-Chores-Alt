#!/bin/sh
# Runs inside the karsten13/magicmirror container before MagicMirror starts.
# Installs MMM-Chores-Alt runtime deps (better-sqlite3, node-cron) using
# prebuilt Node-native binaries. We skip lifecycle scripts so the module's
# own postinstall (which targets Electron) does not rebuild bindings for the
# wrong runtime - the container runs MagicMirror in server mode under Node.
# --no-package-lock prevents npm from rewriting the host's lockfile with
# Linux-specific optional dep variants.
set -e

MOD_DIR="${MM_DIR}/modules/MMM-Chores-Alt"

if [ ! -f "${MOD_DIR}/node_modules/.installed" ]; then
  echo "[start_script] installing MMM-Chores-Alt runtime deps"
  (cd "${MOD_DIR}" && npm install --omit=dev --ignore-scripts --no-package-lock)
  touch "${MOD_DIR}/node_modules/.installed"
else
  echo "[start_script] MMM-Chores-Alt deps already installed"
fi
