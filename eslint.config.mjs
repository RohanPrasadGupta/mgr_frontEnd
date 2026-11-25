import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Test helpers and specs pass arbitrary JSON request/response bodies around; app code stays strictly typed.
  { files: ["test/**", "**/*.test.ts", "**/*.test.tsx", "e2e/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / tool output.
    "lib/api/schema.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
