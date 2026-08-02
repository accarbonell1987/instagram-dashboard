import node from "@core/config/eslint/node";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["src/generated/**", "dist/**", "coverage/**", "vitest.setup.ts"] },
  ...node,
];
