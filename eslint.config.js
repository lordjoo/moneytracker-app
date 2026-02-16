import js from '@eslint/js';
import vue from 'eslint-plugin-vue';

const sharedGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  structuredClone: 'readonly',
  crypto: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  console: 'readonly',
  process: 'readonly',
  module: 'readonly',
  require: 'readonly',
  __dirname: 'readonly'
};

export default [
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      '.eslintrc.cjs',
      'postcss.config.cjs',
      'tailwind.config.cjs',
      'src/views/TransactionsView.old.vue',
      'src/views/TransactionsView.vue.backup'
    ]
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off'
    }
  }
];
