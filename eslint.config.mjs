import { dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import Next.js ESLint configurations directly
const nextConfig = require("./node_modules/eslint-config-next/dist/index.js");
const nextCoreWebVitalsConfig = require("./node_modules/eslint-config-next/dist/core-web-vitals.js");
const nextTypescriptConfig = require("./node_modules/eslint-config-next/dist/typescript.js");

// Combine the configurations, adding overrides for the project's style:
// - loose TypeScript + any/@ts-ignore convention
// - arbitrary podcast artwork (no next/image remote-patterns)
// - future build pipeline using environment that does not need CI
const eslintConfig = [
  ...nextCoreWebVitalsConfig,
  ...nextTypescriptConfig,
  {
    rules: {
      // Turn off rules that conflict with the project's loose-TS convention
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@next/next/no-img-element': 'off',
      // Turn off no-require-imports (db uses require() import)
      '@typescript-eslint/no-require-imports': 'off',
      // Permit eslint-disable comments for hooks without warning
      'react-hooks/exhaustive-deps': 'off',
      // Disable set-state-in-effect: initialization patterns (localStorage, dynamic import)
      // are legitimate and refactoring them would be premature optimization
      'react-hooks/set-state-in-effect': 'off',
    },
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;