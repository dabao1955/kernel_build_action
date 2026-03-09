## Quick Start

- For significant features or refactors, sketch a plan first; keep it updated as you work.
- Default to `rg` for searching and keep edits ASCII unless the file already uses non-ASCII.
- Run the component-specific checks below before handing work off; do not skip failing steps.
- When unsure which path to take, favor minimal risk changes that can run the workflow successfully.

## Python Code Quality

All Python scripts must pass linting and type checking before submission:

- **pylint**: Static analysis for code errors, style violations, and best practices
  ```bash
  pylint <script.py>
  ```
- **mypy**: Static type checking to catch type-related errors
  ```bash
  mypy <script.py>
  ```
- **black** (optional but recommended): Code formatter for consistent style
  ```bash
  black <script.py>
  ```
  Alternatively, **ruff** can be used as a faster all-in-one linter and formatter:
  ```bash
  ruff check <script.py>
  ruff format <script.py>
  ```

Configuration is provided in `.pylintrc` for pylint settings. Ensure all Python modifications pass these checks before committing.

## TypeScript Code Quality

All TypeScript source files must pass linting, formatting, and testing before submission:

- **ESLint**: Static analysis for code errors and style violations
  ```bash
  yarn lint
  ```
- **Prettier**: Code formatter for consistent style
  ```bash
  yarn format
  # Check formatting without modifying files
  yarn format:check
  ```
- **Vitest**: Run tests with coverage
  ```bash
  yarn test --run
  # Run with coverage report
  yarn test --coverage
  ```
- **Build**: Ensure TypeScript compiles without errors
  ```bash
  yarn build
  ```

Configuration files:
- `eslint.config.js`: ESLint flat configuration (v9+)
- `.prettierrc`: Prettier formatting rules
- `tsconfig.json`: TypeScript compiler options
- `vitest.config.ts`: Test framework configuration

Ensure all TypeScript modifications pass these checks before committing.

## Git Commit

> **Note**: If this repository was cloned with `--depth=1` (shallow clone), run `git fetch --unshallow` or `git fetch --depth=100` to retrieve commit history before referencing existing commit styles.

- Mirror existing history style: 
```
component: <type>[optional scope]: <Description>

[optional body]

[optional footer(s)]
```
example:
```
rekernel: feat(patch): Using cocci patch
Convert C code modifications from sed to coccinelle semantic patches for
better code maintainability and reliability. Retain sed for Kconfig and
Makefile changes as they are not supported by coccinelle.

This separates the concerns between C code transformations and
configuration file modifications, making the patches more robust and
easier to maintain.

fix #123

Signed-off-by: dabao1955 <dabao1955@163.com>
```
Keep the summary concise, start with a capital letter, and avoid trailing period.
- Prefer one scope; if multiple areas change, pick the primary one or spilt to a couple of scopes rather than chaining scopes. 
- Keep subject lines brief (target ≤72 chars), no body unless necessary. If referencing a PR/issue, append `(fix #123)` at the end as seen in history.
- Before committing, glance at recent `git log --oneline` to stay consistent with current prefixes and capitalization used in this repo.

### Pre-commit Checks

Run the appropriate checks based on file types modified:

- **YAML files**: `yamllint <file.yml>`
- **Python scripts**: `pylint <script.py>` and `mypy <script.py>`
- **TypeScript files**: `yarn lint`, `yarn format:check`, `yarn test --run`, and `yarn build`
- **All changes**: Ensure `yarn build` succeeds and dist files are updated
