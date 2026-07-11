import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const reactRulesOff = Object.fromEntries(
  Object.keys(react.rules).map((rule) => [`react/${rule}`, "off"]),
);

const reactHooksRulesOff = Object.fromEntries(
  Object.keys(reactHooks.rules).map((rule) => [`react-hooks/${rule}`, "off"]),
);

export default tseslint.config(
  {
    ignores: ["public/**", "dist/**", "*.js", "*.mts", "plugins/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "themes/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactRulesOff,
      ...reactHooksRulesOff,
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],
      "no-shadow": "off",
      "no-empty": "off",
      "no-void": "off",
      "no-use-before-define": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
