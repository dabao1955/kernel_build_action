import * as fs from 'fs';
import * as yamlLint from 'yaml-lint';

function lintYAMLFile(filePath: string): Promise<void> {
  const pendingMessage = `Checking ${filePath} ... [pending]`;
  process.stdout.write(pendingMessage);

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        process.stdout.write(`\r${pendingMessage.replace('[pending]', '[ERROR]'.padEnd('[pending]'.length))}\n`);
        reject(new Error(`Error reading YAML file: ${filePath}`));
      } else {
        yamlLint.lint(data)
          .then(() => {
            process.stdout.write(`\r${pendingMessage.replace('[pending]', '[OK]'.padEnd('[pending]'.length))}\n`);
            resolve();
          })
          .catch(error => {
            process.stdout.write(`\r${pendingMessage.replace('[pending]', '[ERROR]'.padEnd('[pending]'.length))}\n`);
            reject(new Error(`Checking YAML file ${filePath} Unsuccessful.\nError: ${error}\n\nYAML file check failed. Exiting ...`));
          });
      }
    });
  });
}

async function checkYAMLFilesSequentially(): Promise<void> {
  const files: string[] = [
    '../action.yml',
    '../.github/workflows/check.yml',
    '../.github/workflows/build.yml',
    '../.github/workflows/main.yml',
    '../.github/ISSUE_TEMPLATE/bug-report.yml',
    '../.github/ISSUE_TEMPLATE/config.yml',
    '../.github/dependabot.yml',
  ];

  const checkStart = Date.now();
  console.log('Starting check...');
  console.log('Android Kernel Build Action YAML Checker v0.0.3\n');
  for (const file of files) {
    try {
      await lintYAMLFile(file);
    } catch (error) {
      console.error(error.message);
      process.exit(255);
    }
  }

  const totalDuration = Date.now() - checkStart;
  console.log(`\nAll YAML files checked successfully, Total duration: ${totalDuration}ms`);
}

checkYAMLFilesSequentially();

