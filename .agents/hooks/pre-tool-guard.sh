#!/bin/bash
PAYLOAD=$(cat -)
TARGET_PATH=$(echo "$PAYLOAD" | grep -oP '"path"\s*:\s*"\K[^"]+')

if [[ "$TARGET_PATH" == /usr/share/omarchy/* ]] || [[ "$TARGET_PATH" == /etc/* ]] || [[ "$TARGET_PATH" == *.env* ]]; then
  echo "SECURITY ERROR: Operation blocked."
  exit 1
fi
exit 0
