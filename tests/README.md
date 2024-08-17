Android Kernel Build action tests
======

> [!NOTE] Note 
> 
> that this is not strictly a test, it is just a yaml-lint to check if each yml file is legitimate.

## How to use
First, you must install nodejs and npm.

slSecond, run `npm install` in tests directory.

sFinally, run `npm run` or `node index.js` in tests directory.

Such as:

```bash
user@localhost ~/k/tests (main)> node index.js
Starting check...
Android Kernel Build Action YAML Checker v0.0.2

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
