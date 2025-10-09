module.exports = {
  root: true,
  env: {
    browser: true,
    es2023: true
  },
  extends: ['eslint:recommended', 'plugin:vue/vue3-recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'vue/multi-word-component-names': 0,
    'vue/no-multiple-template-root': 0
  }
};
