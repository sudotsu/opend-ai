import { defaultExclude, defineConfig } from 'vitest/config';

// Git worktrees are created under .worktrees/, which lives inside the repo. Its
// checkouts contain the same src/*.test.ts files, so a bare `vitest run` from
// the repo root collects every branch that happens to be checked out and reports
// a doubled test count. Setting `exclude` replaces the defaults rather than
// extending them, so defaultExclude is spread back in.
export default defineConfig({
  test: {
    exclude: [...defaultExclude, '**/.worktrees/**', '**/dist/**']
  }
});
