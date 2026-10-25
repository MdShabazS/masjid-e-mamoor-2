import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],
  },
  {
    files: ['apps/**/*.{js,jsx,mjs}', 'backend/**/*.js', 'packages/**/*.js', 'scripts/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-constant-condition': 'error',
      'no-duplicate-imports': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/**/*.jsx'],
    rules: {
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^(React|_)' }],
    },
  },
];
