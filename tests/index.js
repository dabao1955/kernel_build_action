const fs = require('fs');
const yamlLint = require('yaml-lint');

function lintYAMLFile(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Checking YAML file ${filePath} ...`);

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(`Error reading YAML file: ${filePath}`);
        process.exit(127);
      } else {
        yamlLint.lint(data)
          .then(() => {
            console.log(`Checking YAML file ${filePath} successful.`);
            resolve();
          })
          .catch(error => {
            reject(`Checking YAML file ${filePath} Unsuccessful, Error: ${error}`);
            process.exit(255);
          });
      }
    });
  });
}

Promise.all([
  lintYAMLFile('../action.yml'),
  lintYAMLFile('../.github/workflows/main.yml')
]).then(() => {
  console.log('Both YAML files are valid.');
}).catch((error) => {
  console.error(error);
});
