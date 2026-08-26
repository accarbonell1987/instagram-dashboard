import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    plugins: {
      "import-x": importX,
    },
    rules: {
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import-x/no-duplicates": "error",
      // The rule guards against objects and null stringifying into garbage.
      // Numbers are unambiguous, and forbidding them breaks typed field paths
      // like `accounts.${index}.bankName` — wrapping the index in String()
      // widens the template literal type and React Hook Form stops matching it
      // against Path<T>.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    // Los matchers de vitest devuelven `any` por diseno: `expect.objectContaining()`
    // no se puede tipar, y `expect(mock.metodo)` es COMO se asierta un mock, no un
    // metodo desligado de su objeto. Estas reglas existen para atrapar `any`
    // fluyendo por codigo de produccion; en un test solo empujan a escribir
    // aserciones peores para callarlas.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".next/",
      // `distDir` en desarrollo (ver next.config.ts): artefactos de build, no fuente.
      ".next-dev/",
      "coverage/",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "*.cjs",
      // Generado por Next en cada build.
      "next-env.d.ts",
      // Tooling, no codigo fuente: vive fuera del `include` del tsconfig y el
      // project service de typescript-eslint no puede parsearlo.
      "vitest.setup.ts",
      // Generado por `msw init`, no es codigo fuente del proyecto.
      "**/mockServiceWorker.js",
    ],
  },
];
