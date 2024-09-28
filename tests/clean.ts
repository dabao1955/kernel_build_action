import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

const fileExist = fs.existsSync("./.git");
const T = fs.existsSync("./tests");

if (fileExist) {
    try {
        execSync("git clean -dxf");
        execSync("git checkout .");
    } catch (error) {
        console.error("Error executing git commands:", error);
    }
} else {
    if (T) {
        try {
            fs.unlinkSync("tests/yarn.lock");
            fs.unlinkSync("kernelsu/ksupatch.sh");
            fs.unlinkSync("tests/shfmt");
            fs.rmdirSync("tests/node_modules", { recursive: true });

            process.chdir("kernelsu");

            const url = 'https://github.com/dabao1955/kernel_build_action/raw/main/kernelsu/patch.sh';
            https.get(url, (response) => {
                if (response.statusCode === 200) {
                    console.log(`${response.statusCode}.Success`);
                } else {
                    console.error(`${response.statusCode}.Failed`);
                    process.exit(1);
                }
            }).on('error', (e) => {
                console.error(`Error fetching URL: ${e.message}`);
                process.exit(1);
            });
        } catch (error) {
            console.error("Error handling files or directories:", error);
        }
    }
}

