#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_BIN="$(mktemp -t wild-drift-core)"
trap 'rm -f "$CHECK_BIN"' EXIT
xcrun clang++ -std=c++20 -O2 -Wall -Wextra -Werror -I "$ROOT/WildDrift/Source/WildDrift" "$ROOT/tests/core.cpp" -o "$CHECK_BIN"
"$CHECK_BIN"
