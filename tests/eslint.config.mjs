import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        files: ["index.js"],
        linterOptions: {
            reportUnusedDisableDirectives: true
        },
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "script"
        },
        rules: {
            semi: "error"
        }
    }
];

