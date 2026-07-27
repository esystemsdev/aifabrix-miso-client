# push-github

Push the developer's current release branch, run a manual CodeQL scan, merge branch into `main` **without PR**, then publish `@aifabrix/miso-client` via GitHub Release and monitor NPM publish.

**Repo:** Run from **aifabrix-miso-client** root only.

**Never bumps version** — use `/repair-release` for version and `CHANGELOG.md` updates.

**Related commands:**

- `/validate-tests` — local quality gate before push and before retries
- `/repair-release` — version bump + changelog preparation

---

## No-PR mode policy

- This command merges release branch into `main` directly (no PR creation).
- Branch/repository rules must allow direct merge/push to `main`.
- If direct merge/push to `main` is blocked, stop and report the block reason.

---

## AskQuestion gates (reference)

| Gate | Question `id` | Proceed when option `id` is |
| ---- | ------------- | --------------------------- |
| Preflight - version already on NPM | `repair-release-bump` | `bump-patch`, `bump-minor`, or `bump-explicit` |
| Preflight - changelog mismatch | `repair-release-changelog` | `run-repair-release` |
| Phase 1 - push current branch (only when needed) | `push-release-branch` | `push-yes` |
| Phase 2 - run manual CodeQL workflow | `run-codeql-scan` | `scan-yes` |
| Phase 3 - fix CodeQL findings | `fix-codeql-findings` | `fix-yes` |
| Phase 4 - merge branch into main | `merge-into-main` | `merge-yes` |
| Phase 5 - create GitHub Release | `create-release` | `release-yes` |
| Phase 7 - retry publish after fix | `retry-publish` | `retry-yes` |

### Preflight - version already on NPM (`repair-release-bump`)

Use when `pnpm view @aifabrix/miso-client@{version} version` succeeds.

```json
{
  "title": "Version bump required",
  "questions": [{
    "id": "repair-release-bump",
    "prompt": "@aifabrix/miso-client@{version} is already published on NPM.\n\nRecommend patch {patchNext} unless this release adds significant new features.\n\nRun /repair-release?",
    "options": [
      { "id": "bump-patch", "label": "Patch bump -> {patchNext} (Recommended)" },
      { "id": "bump-minor", "label": "Minor bump -> {minorNext}" },
      { "id": "bump-explicit", "label": "Use version {explicitVersion} (user specified)" },
      { "id": "bump-stop", "label": "Stop - I'll handle version manually" }
    ]
  }]
}
```

### Preflight - CHANGELOG mismatch (`repair-release-changelog`)

```json
{
  "title": "CHANGELOG out of sync",
  "questions": [{
    "id": "repair-release-changelog",
    "prompt": "CHANGELOG top entry does not match package.json ({version}).\n\nAgent recommends: {recommendedBump} -> {recommendedVersion}",
    "options": [
      { "id": "run-repair-release", "label": "Run /repair-release for {recommendedVersion} (Recommended)" },
      { "id": "repair-stop", "label": "Stop - I'll fix CHANGELOG manually" }
    ]
  }]
}
```

### Phase 1 - push current branch (`push-release-branch`)

```json
{
  "title": "Push release branch",
  "questions": [{
    "id": "push-release-branch",
    "prompt": "Push `{sourceBranch}` to origin?\n\nVersion: {version}\nPackage: @aifabrix/miso-client\nLocal /validate-tests: passed",
    "options": [
      { "id": "push-yes", "label": "Yes, push branch (Recommended)" },
      { "id": "push-no", "label": "Not now" },
      { "id": "push-stop", "label": "Stop - I need to change something" }
    ]
  }]
}
```

### Phase 2 - run CodeQL scan (`run-codeql-scan`)

```json
{
  "title": "Run manual CodeQL scan",
  "questions": [{
    "id": "run-codeql-scan",
    "prompt": "Run manual CodeQL workflow on `{sourceBranch}` before merge?",
    "options": [
      { "id": "scan-yes", "label": "Yes, run CodeQL scan (Recommended)" },
      { "id": "scan-no", "label": "No - stop here" }
    ]
  }]
}
```

### Phase 3 - fix CodeQL findings (`fix-codeql-findings`)

```json
{
  "title": "CodeQL findings detected",
  "questions": [{
    "id": "fix-codeql-findings",
    "prompt": "Manual CodeQL scan found security findings.\n\nDo you want me to fix them now using best practices (root-cause fixes, minimal scope, regression safety)?",
    "options": [
      { "id": "fix-yes", "label": "Yes, fix findings with best practices (Recommended)" },
      { "id": "fix-no", "label": "No - stop for manual handling" }
    ]
  }]
}
```

### Phase 4 - merge branch into main (`merge-into-main`)

```json
{
  "title": "Merge release branch into main",
  "questions": [{
    "id": "merge-into-main",
    "prompt": "CodeQL scan is green.\n\nMerge `{sourceBranch}` into `main` now (no PR mode)?",
    "options": [
      { "id": "merge-yes", "label": "Yes, merge into main (Recommended)" },
      { "id": "merge-no", "label": "No - stop before merge" }
    ]
  }]
}
```

### Phase 5 - create GitHub Release (`create-release`)

```json
{
  "title": "Create GitHub Release",
  "questions": [{
    "id": "create-release",
    "prompt": "Create and publish GitHub Release `v{version}` from `main`?\n\nThis triggers `.github/workflows/publish.yml`.",
    "options": [
      { "id": "release-yes", "label": "Yes, create release and monitor publish (Recommended)" },
      { "id": "release-no", "label": "No - stop after merge" }
    ]
  }]
}
```

### Phase 7 - retry publish after fix (`retry-publish`)

```json
{
  "title": "Retry npm publish",
  "questions": [{
    "id": "retry-publish",
    "prompt": "Publish workflow failed.\n\nRetry after fixes using `workflow_dispatch` for version {version}?",
    "options": [
      { "id": "retry-yes", "label": "Yes, retry publish (Recommended)" },
      { "id": "retry-no", "label": "No - stop here" }
    ]
  }]
}
```

### GitHub Release format (required)

New releases must match current repository style:

- **Title (`name`)**: `Release v{version}`
- **Tag**: `v{version}`
- **Target**: `main`
- **Draft**: `false`
- **Prerelease**: `false`
- **Body template**:

```text
## @aifabrix/miso-client v{version}

AI Fabrix Client SDK - Authentication, authorization, logging, and Express.js utilities

### Installation
npm install @aifabrix/miso-client@{version}

See the [commits](https://github.com/esystemsdev/aifabrix-miso-client/commits/v{version}) for detailed changes.
```

---

## Phase 0 - Preflight

1. Verify source branch:
   - `git branch --show-current` -> source branch
   - source branch must not be `main`
2. Verify clean tree and upstream:
   - `git status --porcelain` must be empty
   - `git fetch origin`
   - if upstream exists, local must not be behind
3. Verify release metadata:
   - `package.json` version exists and is intended release version
   - top `CHANGELOG.md` entry matches package version
4. Verify version is not on NPM:
   - `pnpm view @aifabrix/miso-client@{version} version`
   - if exists, resolve via `repair-release-bump`
5. Run `/validate-tests` and require green before continue.

---

## Phase 1 - Push source branch (when needed)

1. Compare local vs remote:
   - `git rev-list --left-right --count origin/{sourceBranch}...{sourceBranch}`
2. If `ahead=0` and `behind=0`, skip push.
3. If ahead or remote missing, AskQuestion `push-release-branch`; on `push-yes`, run:

```bash
git push origin {sourceBranch}
```

---

## Phase 2 - Run manual CodeQL scan

1. AskQuestion `run-codeql-scan`; continue only on `scan-yes`.
2. Trigger manual workflow on source branch:

```bash
gh workflow run codeql-manual.yml --ref {sourceBranch}
```

3. Monitor until complete:

```bash
gh run list --workflow "codeql-manual.yml" --branch {sourceBranch} --limit 3
gh run watch <run-id> --exit-status
```

4. If workflow is green, continue to Phase 4.
5. If workflow fails due CodeQL findings, continue to Phase 3.

---

## Phase 3 - Fix CodeQL findings (best practices)

1. AskQuestion `fix-codeql-findings`.
2. On `fix-yes`:
   - inspect failing annotations/logs
   - apply root-cause fixes with minimal scope
   - avoid blanket suppressions unless unavoidable
   - keep behavior/regression safety through tests
3. Re-run `/validate-tests`.
4. Commit fixes on source branch.
5. Push source branch.
6. Re-run Phase 2 manual CodeQL scan.
7. Repeat until CodeQL is green.
8. On `fix-no`, stop and report findings.

---

## Phase 4 - Merge source branch into main (no PR)

1. AskQuestion `merge-into-main`; continue only on `merge-yes`.
2. Ensure latest remote refs:

```bash
git fetch origin
```

3. Merge sequence:

```bash
git checkout main
git pull origin main
git merge --no-ff {sourceBranch}
git push origin main
git checkout {sourceBranch}
```

4. If push to `main` is blocked by branch/rules, stop and report block reason.

---

## Phase 5 - Create and publish GitHub Release

1. AskQuestion `create-release`; continue only on `release-yes`.
2. Ensure `v{version}` tag does not already exist.
3. Create release in required format:

```bash
gh release create v{version} --target main --title "Release v{version}" --notes "$(cat <<'EOF'
## @aifabrix/miso-client v{version}

AI Fabrix Client SDK - Authentication, authorization, logging, and Express.js utilities

### Installation
npm install @aifabrix/miso-client@{version}

See the [commits](https://github.com/esystemsdev/aifabrix-miso-client/commits/v{version}) for detailed changes.
EOF
)"
```

4. This triggers `.github/workflows/publish.yml`.

---

## Phase 6 - Monitor publish workflow

1. Monitor latest publish run:

```bash
gh run list --workflow "publish.yml" --limit 3
gh run watch <run-id> --exit-status
```

2. On success verify:
   - workflow green
   - `pnpm view @aifabrix/miso-client@{version} version` resolves expected version
3. On failure, continue to Phase 7.

---

## Phase 7 - Publish fix loop (no version bump)

1. Inspect failing logs:
   - `gh run view <run-id> --log-failed`
2. Fix on source branch with best practices.
3. Re-run `/validate-tests`.
4. Commit and push source branch.
5. Merge updated source branch into `main` again (Phase 4).
6. AskQuestion `retry-publish`; on `retry-yes` run:

```bash
gh workflow run "publish.yml" --ref main -f version={version} -f create_tag=false
```

7. Re-monitor publish workflow and repeat until success.

---

## Work is complete when

- Manual CodeQL scan passed on source branch.
- Source branch was merged into `main` (no PR mode).
- GitHub publish workflow succeeded.
- NPM confirms `@aifabrix/miso-client@{version}` availability.

---

## Critical requirements

- No PR creation/merge in this command.
- Always run manual CodeQL scan before merge into `main`.
- If CodeQL finds issues, always ask whether to auto-fix with best practices.
- Never bump version in `/push-github`.
- Always run `/validate-tests` before initial push and after each fix iteration.
