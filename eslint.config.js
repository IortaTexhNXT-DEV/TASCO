'use strict';

const js = require('@eslint/js');
const globals = require('globals');

/** Lint configuration (flat config). Quality gate in CI: zero errors. */
module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'public/vendor/**', 'docs/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      complexity: ['warn', 25],
      'max-depth': ['warn', 5],
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Use the h()/mount() DOM helpers (XSS-safe).' },
        { property: 'outerHTML', message: 'Use the h()/mount() DOM helpers (XSS-safe).' }],
      'prefer-const': 'error',
    },
  },
];
