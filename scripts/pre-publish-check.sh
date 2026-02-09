#!/bin/bash

echo "🔍 Pre-publish validation checklist..."

# Check version in package.json
VERSION=$(node -p "require('./package.json').version")
echo "✅ Version: $VERSION"

# Check if git tag exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "❌ Git tag v$VERSION already exists"
  exit 1
else
  echo "✅ Git tag v$VERSION does not exist"
fi

# Run build
echo "🔨 Building..."
pnpm run build || exit 1
echo "✅ Build successful"

# Run linter
echo "🔍 Linting..."
pnpm run lint || exit 1
echo "✅ Lint passed"

# Run tests
echo "🧪 Testing..."
pnpm test || exit 1
echo "✅ Tests passed"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "❌ Uncommitted changes detected"
  exit 1
else
  echo "✅ No uncommitted changes"
fi

# Verify package contents
echo "📦 Package contents:"
pnpm pack --dry-run
echo "✅ Package contents verified"

echo "✨ All pre-publish checks passed!"
echo "📝 Next steps:"
echo "  1. pnpm version [patch|minor|major]"
echo "  2. git push && git push --tags"
echo "  3. Create GitHub release"
echo "  4. Automated publish will trigger"

