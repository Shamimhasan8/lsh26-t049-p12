#!/bin/bash
# Package the final deliverable: clean repo + ZIP in /home/z/my-project/download/
set -e
BASE=/home/z/my-project
STAGE=$BASE/download/lsh26-t049-p12
ZIP=$BASE/download/lsh26-t049-p12.zip

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE" "$BASE/download"

# copy working tree, excluding runtime/scaffold noise
rsync -a \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.zscripts' \
  --exclude 'agent-ctx' \
  --exclude 'tool-results' \
  --exclude 'upload' \
  --exclude 'download' \
  --exclude 'skills' \
  --exclude 'db' \
  --exclude '*.log' \
  --exclude 'worklog.md' \
  --exclude '.env' \
  --exclude '.gitignore.orig' \
  "$BASE/" "$STAGE/"

# never ship local test screenshots / dumps or scaffold noise
rm -f "$STAGE"/scripts/shot-*.png "$STAGE"/scripts/engine-dump.json "$STAGE"/public/test-receipt.png
rm -rf "$STAGE"/examples "$STAGE"/mini-services
rm -f "$STAGE"/Caddyfile

# clean git history: commit 1 = EVENT.md only, commit 2 = everything else
cd "$STAGE"
git init -b main -q
git config user.name "AdilShamim8"
git config user.email "AdilShamim8@users.noreply.github.com"
git add EVENT.md
git commit -q -m "chore: event start record (LSH26-8490-C900)"
git add -A
git commit -q -m "feat: P12 Personal Ledger Manager — TakaTrack (final submission)"
echo "---- history ----"
git log --oneline
echo "---- files ----"
git ls-files | head -40
echo "---- total files: $(git ls-files | wc -l) ----"

# zip (including .git for the ready history)
cd "$BASE/download"
zip -qr "$ZIP" lsh26-t049-p12 -x '*/node_modules/*'
ls -lh "$ZIP"
