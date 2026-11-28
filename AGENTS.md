# AGENTS.md

## Scope

- This repo is primarily a single GitHub Action. The shipped entrypoints are `action.yml -> dist/index.js` and `dist/post/index.js`; source lives in `src/index.ts` and `src/post.ts`.
- Python files are not incidental scripts: `config.py`, `kernelsu/`, `lxc/`, `nethunter/`, and `rekernel/` have their own lint and pytest coverage in CI.

## Commands

- Install JS deps with `pnpm install`. CI uses pnpm, not npm/yarn.
- Rebuild the action with `pnpm build` after changing `src/**/*.ts`. This regenerates the committed `dist/` entrypoints used by `action.yml`.
- TypeScript checks: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm biome`.
- Python checks: `python3 -m pytest`, `mypy --explicit-package-bases kernelsu/ lxc/ nethunter/ rekernel/ config.py`, `pylint kernelsu/ lxc/ nethunter/ rekernel/ config.py`.
- Focused TS test: `pnpm vitest run __tests__/builder.test.ts`.
- Focused Python test: `python3 -m pytest __pytest__/rekernel/test_patch.py`.
- Re:Kernel module build check: `make -j4 V=1` in `rekernel/`.

## Verification Order

- For `src/` changes: run `pnpm build` first, then the smallest relevant subset of `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm biome`.
- For Python helper changes: run the smallest relevant `python3 -m pytest` target first, then `mypy` and `pylint` for the touched Python paths.
- For changes that affect both TS action flow and Python patch helpers, run both stacks.

## Repo-Specific Gotchas

- Do not treat `.github/workflows/build.yml` as action logic. It is an example usage workflow; PRs that modify it are auto-closed by `.github/workflows/close-pr.yml`.
- The action is designed for GitHub Actions Linux runners only. `src/utils.ts` hard-fails unless `GITHUB_ACTIONS=true`, platform is Linux, and `apt` or `pacman` is available.
- Local kernel sources are only recognized when `kernel-url` is `.` or a relative path ending with `/`; otherwise the action treats it as a remote clone target.
- `extra-make-args` is parsed as a JSON array string, not a shell fragment.
- Biome is lint-only here. `biome.json` disables Biome formatting and import organization; formatting checks come from Prettier.

## Architecture Notes

- `src/index.ts` orchestrates the full build: validate inputs/environment, install system deps/toolchains, fetch kernel sources, apply feature patches, build, package, upload/release.
- `src/post.ts` is always-run cleanup/error analysis; if you change build failure behavior, check post-action state handling too.
- Feature integrations call repo-local Python helpers from TS (`config.py`, `rekernel/patch.py`, `nethunter/patch.py`, `lxc/patch_cocci.py`, `kernelsu/apply_cocci.py`), so cross-language regressions are easy to introduce.
