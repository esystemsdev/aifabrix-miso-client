# push-release-branch

Promote the current development branch (normally `dev`) to `release/miso-client-{major}.{minor}.0`, validate it, run CodeQL, and open a PR to `main` for human review.

**Repo:** `aifabrix-miso-client` root only. **Process:** [deployment](../process/deployment.md).

## Modes and authorization

- `/push-release-branch`: show the concrete release plan, then confirm release preparation, commit/push, and PR creation as needed.
- `/push-release-branch silent`: one confirmation covers the disclosed sync, version preparation, validation, scoped commit, release-branch push, and CodeQL dispatch. PR creation is a separate final decision unless explicitly authorized by the user.

Honor existing session authorization. Use an available question tool for missing authorization, or numbered choices in chat. Show exact files, version, source/target refs and actions before asking. A decline stops the applicable action. `silent` reduces confirmation windows; it does not skip validation or progress reporting.

This command does not tag, publish, merge PRs, or push to `main`. Publication follows human review through [/push-github](push-github.md).

## 0. Readiness and plan

```bash
git branch --show-current
git status --short --branch
git fetch --prune origin
git branch -r --list 'origin/release/miso-client-*'
```

1. Record repository, original source branch, upstream, ahead/behind, and dirty/untracked files. Detached HEAD or `main` is blocked; a release branch as source requires an explicit maintenance request. `dev` is the normal source.
2. Identify relevant uncommitted work explicitly. Exclude unrelated files, credentials, and evidence directories; never stash, discard, or commit unrelated work automatically. Resolve unsafe upstream divergence before proceeding.
3. Read root `package.json` and `CHANGELOG.md`. Reuse an already prepared unpublished version with a matching changelog; otherwise propose a version using `/repair-release` change analysis. Only an explicit npm version-not-found response establishes availability; network/authentication failures are blockers.
4. Derive the target from the **intended** version: `4.22.4` maps to `release/miso-client-4.22.0`; `4.23.0` maps to `release/miso-client-4.23.0`. Parse release lines numerically by major/minor, never by commit date. Report the latest line, but do not automatically merge another version line into a maintenance release.
5. Check target existence and ancestry relative to source. Inspect `origin/main` for missing release/hotfix commits and include required sync in the plan.
6. Verify GitHub/npm access and the existing `codeql-manual.yml` and `publish.yml` workflows. CodeQL uses manual dispatch; publishing uses `release: published`. Release-branch pushes intentionally do not publish npm.
7. Show source/upstream, target existence/SHA, required merges, current → intended version, scoped files/changelog, validation, push refspec, CodeQL dispatch, and PR intent. Obtain any missing authorization.

## 1. Synchronize and prepare

Merge the target release branch into source if needed to preserve release fixes. Bring missing `main` fixes back into source as disclosed. Resolve conflicts without dropping intended changes; stop if the correct resolution needs user input.

Re-read metadata after synchronization. If the version/target or approved actions change materially, show the revised plan before external actions.

Run [/repair-release](repair-release.md) only when preparation is needed. Reuse its version/changelog result; do not bump twice on retries. The root package is the SDK release version; independent `server/` packages need not match it.

## 2. Validate and commit

Run [/validate-tests](validate-tests.md), then `pnpm run build:silent`. Inspect `.temp/validation/` on failure, repair relevant issues, and repeat affected checks. Show test typecheck, lint, test, and build results.

Review the final diff, stage explicit relevant paths, and commit the validated release work under the applicable authorization. Never use blanket staging to collect unrelated files. Record `releaseSha`.

## 3. Push release branch

Fetch again and require the remote target (if present) to be an ancestor of `releaseSha`; if it advanced incompatibly, synchronize and validate again. Use the recorded names:

```bash
git push origin "${sourceBranch}:${releaseBranch}"
git fetch --prune origin
```

This creates or updates the release branch without changing the source upstream. Never force push. Require source HEAD and fetched remote release tip both equal `releaseSha`.

For IDE visibility, create a missing local release branch tracking origin. If it exists, safely switch to it, fast-forward with `git merge --ff-only`, and return to source. If divergent or checked out in another worktree, report the condition instead of resetting it. Preserve the original source checkout.

## 4. CodeQL on the release commit

```bash
gh workflow run codeql-manual.yml --ref "$releaseBranch"
```

Identify the dispatched run by workflow, branch, event, dispatch time, and `headSha == releaseSha`. Monitor that run ID and record its URL. Download its actual artifact names into a fresh run-specific directory:

```bash
gh run download "$runId" -n codeql-actions-sarif -D ".temp/codeql/$runId/actions"
gh run download "$runId" -n codeql-javascript-typescript-sarif -D ".temp/codeql/$runId/javascript-typescript"
```

Require both artifacts, valid nonempty SARIF runs, successful workflow status, and zero `runs[].results[]` findings. Missing output is not a clean scan. Inspect logs and available SARIF on failed workflows to distinguish findings from infrastructure errors.

Repair relevant findings on source, validate, commit/push through the same release path, and scan the new SHA. Any changed release tip invalidates previous evidence. Never suppress findings simply to pass the gate.

## 5. PR to main

Verify the remote release tip still equals the validated/scanned SHA. Show base `main`, head release branch, version, SHA, scan URL, proposed title, and any existing PR. Obtain the PR decision if not already authorized; `silent` approval alone does not authorize PR creation.

```bash
gh pr list --base main --head "$releaseBranch" --state open
```

Reuse an existing PR. Otherwise write `.temp/release-pr.md` with changes, version, SHA, validation evidence, CodeQL URL, and review checklist, then:

```bash
gh pr create --base main --head "$releaseBranch" --title "Release Miso Client $version" --body-file .temp/release-pr.md
```

Return the full clickable PR URL as the human approval link. Human reviewers merge using a **merge commit**, preserving the scanned SHA in `main`. Never merge from this command. After merge, `/push-github` publishes.

## Completion

Report source, target, version, verified SHA, validation and CodeQL evidence, local release-pointer status, and review URL (or explicit PR decline). Preserve the original checkout. If checks fail, report the blocker; do not call the release ready. Publication remains pending until human merge and `/push-github`.
