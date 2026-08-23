# Baseline and Validation Evidence

- Audit date: 2026-07-26 (America/Chicago).
- Immutable revision: `69291c115435f33cf121ba44f7437d2cce8cfd46`, detached in a disposable clone.
- Original checkout: `/home/sudotsu/opend-ai`, clean before audit on the pushed `feat/gitignore-aware-grep` branch. Product source remained unchanged.
- Environment: WSL2 Linux 6.18.33.2, Node 22.22.2 with npm 10.9.7, Node 24.12.0, Bubblewrap 0.9.0, Claude Code 2.1.212.
- Native Windows was reachable, but its installed Node was 26.3.0, outside the repository's `>=22 <25` contract; no native behavioral support claim was made from it.

## Repository gates

Both Node 22 and Node 24 passed:

- `npm ci` and prepare/build;
- `npm run build`;
- `npm test`: 16 files, 180 tests;
- `npm run eval`: 20/20 deterministic cases;
- `npm run test:cli`;
- `npm run check:release`;
- `npm pack --dry-run`.

The packed 0.2.0 artifact contained 27 entries, about 55.5 KB packed and 175.5 KB unpacked. Installing that tarball into an isolated prefix produced a working `opend --version` and `opend --help`.

The exact GitHub commit had four successful checks: Ubuntu and Windows on Node 22 and 24. These are automated test/build checks, not blanket native behavioral evidence.

`npm audit --omit=dev` reported zero production vulnerabilities. The full audit reported one high development vulnerability: PostCSS 8.5.16 through Vite/Vitest, GHSA-r28c-9q8g-f849, with a fix available.

The npm registry returned E404 for `opend-ai`. GitHub release v0.2.0 had no attached assets and predates 23 commits on the audited revision.

## Tree effects

Build and evaluation effects were confined to disposable clones. The live workflow created one automatic checkpoint through the normal product path; its exact generated directory was removed after restore and evidence collection. No saved live session remained because the disposable project set `autoSave: false`.
