#!/usr/bin/env bash
# Depois de `tauri android init` (a pasta gen/ não é versionada): pede ao Android acesso a todos os arquivos,
# necessário para ler o vault na pasta do Syncthing (/storage/emulated/0/...). Pode rodar várias vezes.
set -euo pipefail
M="${1:-app/src-tauri/gen/android/app/src/main/AndroidManifest.xml}"
grep -q MANAGE_EXTERNAL_STORAGE "$M" || sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />#' "$M"
grep -q MANAGE_EXTERNAL_STORAGE "$M" && echo "manifesto ok"
