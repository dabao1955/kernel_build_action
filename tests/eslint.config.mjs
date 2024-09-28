import globals from "globals";
import pluginJs from "@eslint/js";
import eslintPluginTypescript from "@typescript-eslint/eslint-plugin";
import parserTypescript from "@typescript-eslint/parser";  // 引入 TypeScript 解析器

export default [
    {
        files: ["*.ts"],  // 针对所有 TypeScript 文件
        linterOptions: {
            reportUnusedDisableDirectives: true
        },
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "script",  // 保持脚本模式
            parser: parserTypescript,  // 使用正确的解析器对象
        },
        plugins: {
            "@typescript-eslint": eslintPluginTypescript,  // 插件定义为对象
        },
        rules: {
            semi: "error",  // 保持现有规则
            "@typescript-eslint/no-unused-vars": "error",  // 示例 TypeScript 规则
        },
    },
];

