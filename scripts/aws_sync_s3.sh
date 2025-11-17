#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI not found. Install v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  exit 2
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 s3://YOUR_BUCKET_NAME [--profile prof --region us-east-1]" >&2
  exit 2
fi

BUCKET="$1"; shift || true
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

"$SCRIPT_DIR/build_public.sh"

# Sync public/ to S3 website bucket
aws s3 sync "$ROOT/public/" "$BUCKET" --delete "$@"
echo "Synced to $BUCKET"
