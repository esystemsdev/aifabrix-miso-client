# Deploying New Version of @aifabrix/miso-client

## Quick Steps

1. **Update Version**

   ```bash
   cd packages/miso-client
   npm version patch  # or minor/major
   ```

2. **Build Package**

   ```bash
   npm run build
   ```

3. **Publish to npm**

   ```bash
   npm publish --access public --no-workspaces
   ```

## Detailed Process

### 1. Version Management

- **Patch**: `npm version patch` - Bug fixes (1.0.0 → 1.0.1)
- **Minor**: `npm version minor` - New features (1.0.0 → 1.1.0)  
- **Major**: `npm version major` - Breaking changes (1.0.0 → 2.0.0)

### 2. Authentication

The npm token is already configured globally. If needed, set it again:

```bash
npm config set //registry.npmjs.org/:_authToken <your token> --no-workspaces
```

### 3. Pre-publish Checks

- ✅ Build succeeds: `npm run build`
- ✅ Tests pass: `npm test` (if tests exist)
- ✅ Linting passes: `npm run lint`

### 4. Package Contents

The following files are automatically included:

- `dist/` - Compiled JavaScript and TypeScript definitions
- `README.md` - Package documentation
- `LICENSE` - MIT license
- `package.json` - Package metadata

### 5. Verification

After publishing, verify at:

- **npm registry**: <https://www.npmjs.com/package/@aifabrix/miso-client>
- **Install test**: `npm install @aifabrix/miso-client@latest`

## Important Notes

- The `prepublishOnly` script automatically runs `npm run build` before publishing
- Use `--no-workspaces` flag to avoid workspace conflicts
- Version bump automatically updates `package.json` and creates a git tag
- Always test the package locally before publishing

## Rollback (if needed)

```bash
npm unpublish @aifabrix/miso-client@version --no-workspaces
```

*Note: Unpublishing is only possible within 72 hours of publishing*
