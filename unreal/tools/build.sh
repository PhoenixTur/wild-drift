#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${UNREAL_ENGINE_ROOT:-/Users/Shared/Epic Games/UE_5.8}"
"$ENGINE/Engine/Build/BatchFiles/Mac/Build.sh" WildDriftEditor Mac Development "$ROOT/WildDrift/WildDrift.uproject" -WaitMutex
