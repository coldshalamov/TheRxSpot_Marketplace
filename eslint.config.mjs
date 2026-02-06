import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    linterOptions: {
      noInlineConfig: true
    },
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".next/**",
      ".medusa/**",
      "TheRxSpot_Marketplace-storefront/**",
      "uploads/**",
      "reports/**"
    ]
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
      "no-redeclare": "off",
      "no-case-declarations": "off"
    }
  }
)
