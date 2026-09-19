# push-github

Publish `@aifabrix/miso-client` **after** the release PR is reviewed and merged into `main`.

Run from the repository root. Follow [deployment process](../process/deployment.md). Use [/push-release-branch](push-release-branch.md) first to stage development code and obtain the review URL. This command never merges, pushes to `main`, or bumps versions.

## 1. Verify the approved release

1. Fetch origin and tags; record the original checkout and require a clean tree.
2. Identify the merged PR with base `main` and head `release/miso-client-X.Y.0`. Record its URL, approved head SHA, and merge SHA. If still open, return its review URL and stop.
3. Require the approved release head to be an ancestor of `origin/main`. PRs use merge commits to preserve this ancestry; squashed/rebased or ambiguous history requires reconciliation before publishing.
4. Read `package.json` and the matching top `CHANGELOG.md` entry at the approved release SHA. Derive `version` and `releaseTag=v{version}` there, not from the development checkout.
5. Verify successful CodeQL evidence with zero findings for that exact SHA, following `/push-release-branch`.
6. Check npm for the exact version. Only an explicit version-not-found response establishes availability; network/authentication errors are blockers. If already published, verify existing release/tag/run evidence and report it instead of republishing.
7. Validate the release SHA in an isolated worktree with `/validate-tests` and `pnpm run build:silent`. If validation changes tracked files, return fixes through development and a new release PR before publishing.

## 2. Tag and publish GitHub Release

Show version, approved SHA, merged PR URL, validation evidence, and npm publication action. Obtain publication approval unless this exact action is already authorized. Use a question tool if available, otherwise numbered choices in chat. Declining stops publication.

Inspect local and remote `v{version}` tags, including annotated tags' peeled targets. Existing tags must be annotated and resolve to the approved release SHA; stop on conflicts. Fetch and verify an existing remote tag before reuse. Never move, delete, or force-update tags.

Create a missing annotated tag on the approved release SHA, then push only the missing explicit ref:

```bash
git tag -a "$releaseTag" "$releaseSha" -m "Release $releaseTag"
git push origin "refs/tags/${releaseTag}:refs/tags/${releaseTag}"
```

Run each mutation only when needed. Verify the remote peeled tag SHA equals `releaseSha`. Write `.temp/release-notes.md` with actual newlines and substituted values:

```text
## @aifabrix/miso-client v{version}

AI Fabrix Client SDK - Authentication, authorization, logging, and Express.js utilities

### Installation
npm install @aifabrix/miso-client@{version}

See the [commits](https://github.com/esystemsdev/aifabrix-miso-client/commits/v{version}) for detailed changes.
```

Reuse an existing published GitHub Release for this tag. Inspect an existing draft and publish it only under publication authorization. Otherwise create a non-prerelease, non-draft release:

```bash
gh release create "$releaseTag" --verify-tag --title "Release $releaseTag" --notes-file .temp/release-notes.md
```

This publishes the approved commit already included in `main`, even if `main` advanced. Publishing the GitHub Release triggers `publish.yml`; pushing a tag alone does not.

## 3. Monitor publication and recover

- Find the `publish.yml` run associated with this release tag and SHA, record its ID/URL, and monitor that exact run. Never choose an unrelated latest run.
- Require workflow success and npm resolving exactly `@aifabrix/miso-client@{version}`. Allow bounded registry propagation retries; report pending verification honestly.
- On failure, inspect that run's logs and check whether npm publication already succeeded before retrying anything.
- For a transient failure with no published package, retry the same failed run after authorization. Do not dispatch against a moving `main` ref.
- Code/workflow fixes require a new version through `dev → release/miso-client-X.Y.0 → PR → main`. Never alter an existing tag or published npm version.

## Completion

Return merged PR URL, release branch, version, approved SHA, tag, GitHub Release URL, publish run URL, and npm verification result. Preserve the original checkout and remove only temporary worktrees created by this run when clean. Never claim publication succeeded without registry evidence.
