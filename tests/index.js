const fs = require('fs');
const yamlLint = require('yaml-lint');

function lintYAMLFile(filePath) {
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

async function checkYAMLFilesSequentially() {
  const files = [
    '../action.yml',
    '../.github/ISSUE_TEMPLATE/feature_request.yml',
    '../.github/workflows/main.yml',
    '../.github/ISSUE_TEMPLATE/bug-report.yml'
  ];

  for (const file of files) {
    try {
      await lintYAMLFile(file);
    } catch (error) {
      console.error(error.message);
      process.exit(255);
    }
  }

  console.log('\nAll YAML files checked successful.');
}

checkYAMLFilesSequentially();
