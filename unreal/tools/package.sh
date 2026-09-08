#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${UNREAL_ENGINE_ROOT:-/Users/Shared/Epic Games/UE_5.8}"
"$ENGINE/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$ROOT/WildDrift/WildDrift.uproject" -noP4 -platform=Mac -clientconfig=Development -build -cook -stage -package -pak -archive -archivedirectory="$ROOT/artifacts" -unattended -utf8output "$@"
