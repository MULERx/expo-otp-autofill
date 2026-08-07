// ESLint 9 flat config. Replaces the legacy .eslintrc.js, which ESLint 9 no
// longer reads. `expo-module-scripts` provides the shared universe/native base.
const { defineConfig } = require('eslint/config');
const expoModuleConfig = require('expo-module-scripts/eslint.config.base');

module.exports = defineConfig([
  {
    ignores: ['build/**', 'example/**'],
  },
  ...expoModuleConfig,
]);
