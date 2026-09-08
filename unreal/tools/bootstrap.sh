#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${UNREAL_ENGINE_ROOT:-/Users/Shared/Epic Games/UE_5.8}"
"$ENGINE/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor" "$ROOT/WildDrift/WildDrift.uproject" /Engine/Maps/Entry -run=pythonscript -script="$ROOT/tools/bootstrap.py" -unattended -nullrhi -nosplash
