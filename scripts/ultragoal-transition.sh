#!/bin/bash
EXIT_CODE=$1
if [ "$EXIT_CODE" -eq 0 ]; then
  sed -i 's/IN_PROGRESS/COMPLETED/g' .ultragoal/GOAL.md
  echo "State transitioned to COMPLETED."
else
  sed -i 's/IN_PROGRESS/RE_LOOP/g' .ultragoal/GOAL.md
  echo "State transitioned to RE_LOOP."
  exit 1
fi
