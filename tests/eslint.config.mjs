import globals from "globals";
import pluginJs from "@eslint/js";
import eslintPluginTypescript from "@typescript-eslint/eslint-plugin";

export default [
    {
        files: ["*.ts"],
        linterOptions: {
            reportUnusedDisableDirectives: true
        },
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "script",
            parser: "@typescript-eslint/parser",
        },
        plugins: {
            "@typescript-eslint": eslintPluginTypescript,
        },
        rules: {
            semi: "error",
            "@typescript-eslint/no-unused-vars": "error",
        },
    },
];

