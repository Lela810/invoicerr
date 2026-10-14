#!/usr/bin/env bash
# Measures every API route of a running, empty instance and writes result.json into <output dir>.
#
#   e2e/perf/measure.sh <base url> <output dir>
#
# K6 names the k6 binary (default: k6 on PATH). The instance must serve its OpenAPI document at
# /api/docs-json, which every non-production instance does.
set -euo pipefail

base=$1
out=$(mkdir -p "$2" && cd "$2" && pwd)
here=$(cd "$(dirname "$0")" && pwd)
k6=${K6:-k6}

curl -sSf "$base/api/docs-json" -o "$out/openapi.json"
node "$here/seed.mjs" "$base" "$out/context.json"
node "$here/plan.mjs" "$out/openapi.json" "$out/context.json" "$out/plan.json"
"$k6" run --quiet --no-usage-report \
  -e BASE="$base" -e PLAN="$out/plan.json" -e CONTEXT="$out/context.json" -e OUT="$out/result.json" \
  "$here/latency.js"
