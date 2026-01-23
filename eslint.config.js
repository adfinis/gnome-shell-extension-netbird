import gsebuild from "@jon4hz/gsebuild/eslint";
import eslintConfigPrettier from "eslint-config-prettier";

// Consider eslint-plugin-promise again once it supports flat config,
// see https://github.com/eslint-community/eslint-plugin-promise/issues/449

export default [
  ...gsebuild.configs.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        // @ts-ignore
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintConfigPrettier,
  // Global ignores, see https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
  // "ignores" must be the _only_ key in this object!
  {
    ignores: [
      // eslint configs
      "eslint.config.*",
      // Build outputs
      "build/**/*",
      "dist/**/*",
      // Packages
      "node_modules/**",
    ],
  },
];