# Miso Client release process

Development flows through `dev → release/miso-client-X.Y.0 → PR → main → GitHub Release → npm`.

| Step              | Owner / command                                            | Result                                                                  |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Prepare version   | [/repair-release](../commands/repair-release.md)           | Validated version and changelog on development branch                   |
| Stage release     | [/push-release-branch](../commands/push-release-branch.md) | Development commit pushed to release branch; CodeQL evidence and PR URL |
| Approve promotion | Human reviewer                                             | PR merged into `main` with a merge commit                               |
| Publish           | [/push-github](../commands/push-github.md)                 | Immutable annotated tag, GitHub Release, verified npm publication       |

The release branch patch component is always zero: `4.22.0` through `4.22.x` use `release/miso-client-4.22.0`. Derive the line from the intended package version. Development continues on `dev`; a release push does not change its upstream.

`/push-release-branch` prepares a version when needed or reuses `/repair-release` output. Retries reuse the prepared unpublished version. Publication uses the approved release SHA already present in `main`, rather than whichever commit is latest on `main`.

Release branch pushes do not publish packages. The existing manual CodeQL workflow scans the release tip; publishing a GitHub Release triggers `publish.yml`. Keep branch protections configured to require PR review for `main`; command instructions do not configure GitHub repository settings.

Fix release findings on development, then push and scan the updated release branch. New SHAs invalidate prior evidence. Bring release/hotfix changes back into development before the next promotion. Never force-push release history or replace published tags/npm versions. Transient publication failures may retry the same run after confirming the package is absent; content fixes require a new version through the same PR process.
