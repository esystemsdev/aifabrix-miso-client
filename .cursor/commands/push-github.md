# push-github

Push the developer's **current release branch** to GitHub, create and merge a PR into `main` with **strict human approval**, then publish `@aifabrix/miso-client` by creating a GitHub Release from `main` and fixing workflow failures in a loop until NPM publish is successful.

**Repo:** Run from **aifabrix-miso-client** root only.

**Never bumps version** — use `/repair-release` for version and `CHANGELOG.md` updates.

**Related commands:**

- `/validate-tests` — local quality gate before any push
- `/repair-release` — version bump + changelog preparation

---

## Strict policy (always on)

- PR approval in GitHub is **mandatory** before merge.
- Chat confirmation alone is **not** enough to merge.
- Agent must verify approval and green checks via `gh pr view` before merge.

---

## AskQuestion gates (reference)

| Gate | Question `id` | Proceed when option `id` is |
| ---- | ------------- | --------------------------- |
| Phase 1 - push current branch (only when needed) | `push-release-branch` | `push-yes` |
| Preflight - version already on NPM | `repair-release-bump` | `bump-patch`, `bump-minor`, or `bump-explicit` |
| Preflight - changelog mismatch | `repair-release-changelog` | `run-repair-release` |
| Phase 2 - create PR into main | `create-main-pr` | `pr-yes` |
| Phase 4 - merge approved PR | `merge-pr` | `merge-yes` |
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

- `bump-patch` / `bump-minor` / `bump-explicit` -> run `/repair-release`, then repeat preflight.
- `bump-stop` -> stop workflow.

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

### Phase 2 - create PR into main (`create-main-pr`)

```json
{
  "title": "Create PR to main",
  "questions": [{
    "id": "create-main-pr",
    "prompt": "Create PR `{sourceBranch}` -> `main` now?",
    "options": [
      { "id": "pr-yes", "label": "Yes, create PR (Recommended)" },
      { "id": "pr-no", "label": "No - stop after push" }
    ]
  }]
}
```

### Phase 4 - merge PR after approval (`merge-pr`)

```json
{
  "title": "Merge approved PR",
  "questions": [{
    "id": "merge-pr",
    "prompt": "PR #{prNumber} is approved in GitHub and checks are green.\n\nMerge into `main` now?",
    "options": [
      { "id": "merge-yes", "label": "Yes, merge PR (Recommended)" },
      { "id": "merge-wait", "label": "Wait - approval/checks not ready yet" },
      { "id": "merge-stop", "label": "Stop - I will merge manually" }
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

New releases must match the current repository style (same structure as `v4.19.0`):

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

## Phase 0 - Preflight (before any push)

1. **Git state**
   - `git branch --show-current` -> source branch.
   - Source branch must not be `main`.
   - `git status --porcelain` must be empty (all changes committed).
   - `git fetch origin`.
   - If branch has upstream, ensure local is not behind.
   - Stop if dirty, detached, or behind upstream.

2. **Version and release intent**
   - Read `package.json` version.
   - Version must represent the intended release candidate.

3. **CHANGELOG alignment**
   - Top `CHANGELOG.md` entry must match `package.json` version (`## [X.Y.Z] - YYYY-MM-DD`).
   - If mismatch -> AskQuestion `repair-release-changelog`; on `run-repair-release`, run `/repair-release` and repeat preflight.

4. **NPM already published check**
   - `pnpm view @aifabrix/miso-client@{version} version`.
   - If published -> AskQuestion `repair-release-bump`; on bump option, run `/repair-release` and repeat preflight.

5. **Local validation**
   - Run `/validate-tests`.
   - Do not continue until `/validate-tests` is green.

---

## Phase 1 - Push current release branch

1. Check synchronization with remote:

```bash
git rev-list --left-right --count origin/{sourceBranch}...{sourceBranch}
```

2. If local branch is already fully synchronized (`ahead=0`, `behind=0`), skip push gate and continue directly to Phase 2.
3. If local branch is ahead of origin (or remote branch is missing), show a short preflight summary in chat (repo path, source branch, version, validation status), then AskQuestion `push-release-branch`; proceed only on `push-yes`.
4. Push source branch to origin when push is required:

```bash
git push origin {sourceBranch}
```

---

## Phase 2 - Create PR to main

1. AskQuestion `create-main-pr`; proceed only on `pr-yes`.
2. Create PR:
   - **Base:** `main`
   - **Head:** `{sourceBranch}`
3. PR title format:

```text
[X.Y.Z] - YYYY-MM-DD - Release to main
```

4. PR body should include the full `CHANGELOG.md` section for that version.
5. Report PR URL and proceed to approval gate.

---

## Phase 3 - Strict approval wait

1. Wait for **human GitHub approval** and green checks.
2. Verify with:

```bash
gh pr view <number> --json state,reviewDecision,mergeable,statusCheckRollup
```

3. Proceed only when all are true:
   - `state == OPEN`
   - `reviewDecision == APPROVED`
   - `mergeable == MERGEABLE`
   - required checks in `statusCheckRollup` are successful
4. If not approved or checks failing, report status and wait.

---

## Phase 4 - Merge approved PR

1. Proceed only after:
   - GitHub reviewDecision is approved.
   - Required checks are green.
   - AskQuestion `merge-pr` returns `merge-yes`.
2. Merge PR into `main`.
3. Confirm merge SHA.

---

## Phase 5 - Create and publish GitHub Release

1. AskQuestion `create-release`; proceed only on `release-yes`.
2. Ensure release tag `v{version}` does not already exist.
3. Create GitHub Release tag `v{version}` from `main` merge commit.
4. Use the required release format above (`name`, `tag`, `target`, and body template).
5. Recommended command pattern:

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

6. This should trigger `.github/workflows/publish.yml` (`on: release.published`).

---

## Phase 6 - Monitor publish workflow

1. Find and watch the latest `Publish to npm` run.
2. Recommended monitoring commands:

```bash
gh run list --workflow "publish.yml" --limit 3
gh run watch <run-id> --exit-status
```

3. Timeout guideline: wait up to 10 minutes before declaring failure.
4. On success, verify:
   - workflow status is green
   - `pnpm view @aifabrix/miso-client@{version} version` returns expected version
5. Report workflow URL and verification result.

If successful -> done.
If failed -> Phase 7.

---

## Phase 7 - Fix loop (no automatic version bump)

1. Inspect failure logs:
   - `gh run view <run-id> --log-failed`
2. Fix on the same release branch (not on `main` directly).
3. Re-run `/validate-tests` locally.
4. Push fixes to source branch.
5. Create a new PR into `main` (or update existing open PR if one is still open).
6. Repeat Phases 3-4 (strict approval + merge).
7. AskQuestion `retry-publish`; on `retry-yes`, rerun publish via `workflow_dispatch` from `main` with:
   - `version={version}`
   - `create_tag=false` (release tag already exists)

```bash
gh workflow run "publish.yml" --ref main -f version={version} -f create_tag=false
```

8. Re-monitor workflow and repeat until publish succeeds.

**Forbidden in this phase:** bumping `package.json` version inside `/push-github` flow.
If version change is required, stop and run `/repair-release`, then restart from Phase 0.

---

## Work is complete when

- PR from source release branch to `main` is merged after strict GitHub approval.
- GitHub publish workflow is successful.
- NPM confirms `@aifabrix/miso-client@{version}` is available.

---

## Critical requirements

- Always enforce strict approval policy (GitHub review approval is mandatory).
- Always use AskQuestion at the listed gates.
- Never bump version in `/push-github`.
- Always run `/validate-tests` before initial push and in each fix loop iteration.
- Keep the release process traceable: release branch -> PR -> approved merge -> release -> publish verify.
