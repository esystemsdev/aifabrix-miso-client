/**
 * ESLint config aligned with aifabrix-builder quality standards.
 *
 * Aligned with builder: security (no-eval, no-implied-eval, no-new-func, no-script-url,
 * no-alert, no-console warn), complexity (15/4/60/500/6/20), best practices (eqeqeq,
 * no-else-return, radix, prefer-promise-reject-errors, etc.), code quality (prefer-const,
 * no-var, no-trailing-spaces, eol-last, no-multiple-empty-lines, no-tabs).
 *
 * Not copied from builder: formatting (indent, quotes, semi, comma-dangle, etc.) – handled
 * by Prettier (eslint-config-prettier). JSDoc (require-jsdoc/valid-jsdoc) – deprecated in
 * ESLint; use eslint-plugin-jsdoc if needed. camelcase – project uses camelCase; API
 * types already use camelCase.
 *
 * Test overrides: same relaxations as builder (no-console, max-lines*, complexity, etc. off
 * in test files).
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  rules: {
    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'prefer-const': 'error',

    // Security (aligned with builder)
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-alert': 'error',
    'no-console': 'warn',

    // Code quality
    'no-duplicate-imports': 'off', // use @typescript-eslint/no-duplicate-imports if desired
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    'no-multiple-empty-lines': ['error', { max: 1 }],
    'no-mixed-spaces-and-tabs': 'error',
    'no-tabs': 'error',

    // Complexity (aligned with builder & project rules: files <500 lines, methods <60 lines)
    complexity: ['warn', 15],
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['error', 60],
    'max-lines': ['error', 500],
    'max-params': ['warn', 6],
    'max-statements': ['warn', 20],

    // Best practices
    eqeqeq: 'error',
    'no-else-return': 'error',
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-throw-literal': 'off',
    '@typescript-eslint/no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-promise-reject-errors': 'error',
    radix: 'error',
    yoda: 'error',
  },
  overrides: [
    {
      files: ['test*.ts', 'tests/**/*.ts'],
      parserOptions: {
        project: './tsconfig.test.json',
      },
      rules: {
        'no-console': 'off',
        'max-lines-per-function': 'off',
        'max-lines': 'off',
        complexity: 'off',
        'max-statements': 'off',
        'max-depth': 'off',
        'max-params': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['**/*.js'],
      parserOptions: {
        project: null,
      },
    },
  ],
};
