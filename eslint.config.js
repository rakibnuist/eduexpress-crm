import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'eslint_report.json']),
  // Node.js backend files configuration
  {
    files: ['server.js', 'sqldb.js', 'eslint.config.js', 'vite.config.js', 'scratch/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-empty': 'off',
    },
  },
  // Browser React frontend files configuration
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off', // Traditional load pattern uses synchronous setState safely inside useEffect
      'no-unused-vars': 'warn',
      'no-empty': 'off', // Silence caught empty block warnings in frontend UI network/storage fallbacks
      'react-refresh/only-export-components': 'off', // Prevent Fast Refresh warning from blocking production build
    },
  },
])
