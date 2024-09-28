import globals from "globals";
import pluginJs from "@eslint/js";

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
        plugins: ["@typescript-eslint"],
        rules: {
            semi: "error",
            "@typescript-eslint/no-unused-vars": "error",
        },
    },
];

