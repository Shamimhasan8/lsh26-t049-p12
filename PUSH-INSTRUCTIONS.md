# Push instructions for lsh26-t049-p12

This package contains a **clean, ready-to-push git history**:

1. `chore: event start record (LSH26-8490-C900)` — EVENT.md only (the required first event-work commit)
2. `feat: P12 Personal Ledger Manager — TakaTrack (final submission)` — the complete solution

## Option A — repo is still empty (nothing pushed yet)

```bash
cd lsh26-t049-p12
git remote add origin https://github.com/AdilShamim8/lsh26-t049-p12.git
git push -u origin main
```

## Option B — repo already has earlier commits (e.g. you already pushed EVENT.md)

Keep your existing history and add this tree as the final state:

```bash
cd lsh26-t049-p12
git remote add origin https://github.com/AdilShamim8/lsh26-t049-p12.git   # if not present
git fetch origin
git branch -f submission main            # local pointer to this clean tree
git push origin submission:main          # fast-forward if your history is an ancestor; otherwise:
# git push origin submission:main --force   # ONLY if the repo must exactly match this package
```

If you already pushed EVENT.md yourself, the simplest safe path is Option B without force:
copy this package's files over a clone of your repo and commit as one final commit.

## After pushing

1. Copy the exact 40-character SHA of the final commit:
   ```bash
   git rev-parse HEAD
   ```
2. Enter that SHA (not a branch name) in the Final Submission Form.
3. Confirm the deployed live application matches that SHA.
4. Keep the repository public until results are announced.

Author identity used in the bundled history: `AdilShamim8 <AdilShamim8@users.noreply.github.com>`.
If your GitHub noreply address differs, amend before pushing or set your local `git config` and re-commit.
