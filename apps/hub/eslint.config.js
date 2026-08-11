import nextjs from "@core/config/eslint/nextjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextjs,
  {
    // Generated from .atl/api-contract.yaml by `pnpm openapi-types`. Linting a
    // file the generator owns fails the build on style the generator chose,
    // and any fix would be wiped by the next regeneration.
    ignores: ["src/lib/api/types.ts"],
  },
];
