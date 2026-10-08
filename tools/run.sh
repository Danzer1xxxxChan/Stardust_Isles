#!/bin/bash
# Runs a command with TMPDIR on /nfs and captures all output to tools/out/last.txt
# (the machine's root filesystem / /tmp is frequently full).
cd "$(dirname "$0")/.." || exit 1
mkdir -p tools/out/tmp
export TMPDIR="$PWD/tools/out/tmp"
OUT="tools/out/${OUT_NAME:-last}.txt"
{ eval "$@"; echo "[exit $?]"; } > "$OUT" 2>&1
true
