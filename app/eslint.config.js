import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Lint básico: só o que costuma ser erro de verdade (variável inexistente, hook fora de regra).
export default [
  { ignores: ["dist/**", "src-tauri/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off", // AulaDaNota filtra caracteres de controle de propósito
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
