# Deploying New Version of @aifabrix/miso-client

## Quick Steps

1. **Update Version**

   ```bash
   cd packages/miso-client
   pnpm version patch  # or minor/major
   ```

2. **Build Package**

   ```bash
   pnpm run build
   ```

3. **Publish to npm**

   ```bash
   pnpm publish --access public
   ```

## Detailed Process

### 1. Version Management

- **Patch**: `pnpm version patch` - Bug fixes (1.0.0 → 1.0.1)
- **Minor**: `pnpm version minor` - New features (1.0.0 → 1.1.0)
- **Major**: `pnpm version major` - Breaking changes (1.0.0 → 2.0.0)

### 2. Authentication

Local publishing uses **user-global** npm config from Builder secrets (not a repo `.npmrc` or `.npmrc.token` file):

```bash
# One-time: store automation token in shared or user secrets
aifabrix secret set BASH_NPM_TOKEN "<npm-automation-token>" --shared

# Apply to ~/.npmrc
aifabrix npm config

# Verify
npm whoami --registry=https://registry.npmjs.org/
```

For a one-off shell session you may use `export NPM_TOKEN=...` instead.

CI uses GitHub `secrets.NPM_TOKEN` with `setup-node` `registry-url` and `NODE_AUTH_TOKEN` (see `.github/workflows/publish.yml`).

### 3. Pre-publish Checks

- ✅ Build succeeds: `pnpm run build`
- ✅ Tests pass: `pnpm test` (if tests exist)
- ✅ Linting passes: `pnpm run lint`

### 4. Package Contents

The following files are automatically included:

- `dist/` - Compiled JavaScript and TypeScript definitions
- `README.md` - Package documentation
- `LICENSE` - MIT license
- `package.json` - Package metadata

### 5. Verification

After publishing, verify at:

- **npm registry**: <https://www.npmjs.com/package/@aifabrix/miso-client>
- **Install test**: `pnpm add @aifabrix/miso-client@latest`

## Important Notes

- The `prepublishOnly` script automatically runs `pnpm run build` before publishing
- Version bump automatically updates `package.json` and creates a git tag
- Always test the package locally before publishing

## Rollback (if needed)

```bash
pnpm unpublish @aifabrix/miso-client@version
```

_Note: Unpublishing is only possible within 72 hours of publishing_
