## Quick Start

- For significant features or refactors, sketch a plan first; keep it updated as you work.
- Default to `rg` for searching and keep edits ASCII unless the file already uses non-ASCII.
- Run the component-specific checks below before handing work off; do not skip failing steps.
- When unsure which path to take, favor minimal risk changes that can run the workflow successfully.

## Git Commit

- Mirror existing history style: 
```
component: <type>[optional scope]: <description>

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
Keep the summary concise, sentence case, and avoid trailing period.
- Prefer one scope; if multiple areas change, pick the primary one or spilt to a couple of scopes rather than chaining scopes. 
- Keep subject lines brief (target ≤72 chars), no body unless necessary. If referencing a PR/issue, append `(fix #123)` at the end as seen in history.
- Before committing, glance at recent `git log --oneline` to stay consistent with current prefixes and capitalization used in this repo.
- Before committing, run `yamllint` for yml modification or run `shellcheck` for shell script modification.
