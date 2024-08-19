Android Kernel Build action tests
======

> [!NOTE] Note
> that this is not strictly a test, it is just a yaml-lint to check if each yml file is legitimate.

## How to use
First, you must install nodejs and npm.

Second, run `npm install` in tests directory.

Finally, run `npm run check` or `node index.js` in tests directory.

Such as:

```bash
user@localhost ~/k/tests (main)> npm run check
> kernel_build_action_yaml_eheck@0.0.3 check
> node index.js

Starting check...
Android Kernel Build Action YAML Checker v0.0.3

Checking ../action.yml ... [pending]
Checking ../action.yml ... [OK]     
Checking ../.github/workflows/check.yml ... [pending]
Checking ../.github/workflows/check.yml ... [OK]     
Checking ../.github/workflows/build.yml ... [pending]
Checking ../.github/workflows/build.yml ... [OK]     
Checking ../.github/workflows/main.yml ... [pending]
Checking ../.github/workflows/main.yml ... [OK]     
Checking ../.github/ISSUE_TEMPLATE/bug-report.yml ... [pending]
Checking ../.github/ISSUE_TEMPLATE/bug-report.yml ... [OK]     
Checking ../.github/ISSUE_TEMPLATE/config.yml ... [pending]
Checking ../.github/ISSUE_TEMPLATE/config.yml ... [OK]     
Checking ../.github/dependabot.yml ... [pending]
Checking ../.github/dependabot.yml ... [OK]     

All YAML files checked successful,Total duration: 15ms
```
While breaking changes cause failed checking:
```bash
user@localhost ~/k/tests (main)> npm run check
> kernel_build_action_yaml_eheck@0.0.3 check
> node index.js

Starting check...
Android Kernel Build Action YAML Checker v0.0.3

Checking ../action.yml ... [ERROR]
Checking YAML file ../action.yml Unsuccessful.
Error: YAMLException: bad indentation of a mapping entry (257:9)

 254 |              test -d kernel/${{ inputs. ...
 255 |              test -d kernel/${{ inputs. ...
 256 |              echo "::endgroup::"
 257 |         fi
---------------^
 258 |
 259 |          cd kernel/${{ inputs.kernel-dir }}

YAML file check failed. Exiting ...
```
