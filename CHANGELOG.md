# Changelog

## 2026-07-06
- Add `/updates` and `/latest` commands backed by `CHANGELOG.md`
- Expand thinking-stream palette: URLs get blue underline, CONSTANT_CASE gets orange, CLI flags get violet
- Remove italic from thinking text — dim gray only, no italic
- Add three new render tests covering url / constant / flag token matching

## 2026-07-05
- Bump vitest 2.1.9 → 4.1.10, resolves esbuild CVE GHSA-67mh-4wv8-2f99
- Zero vulnerabilities after npm audit

## 2026-07-04
- Add semantic color highlighting to thinking stream (paths=green, tools=cyan, quotes=pink, numbers=amber)
- Add custom animated spinner with on-brand phrases and brightness wave
- Fix stale banner text (was "Venice.ai", now "opend-ai")
- Add real provider switching: VENICE_BASE_URL, OPENAI_BASE_URL, venice_parameters conditional
- Add auto-save-on-exit across all exit paths (SIGINT, readline close, natural exit)
- Rename project from venice-ai to opend-ai; published to github.com/sudotsu/opend-ai
- Fix confirm prompt bug where "yy" was accepted as yes (rl.question pattern)

## 2026-07-03
- Add session management: /save, /load, /sessions
- Add /posture toggle (coding ⇄ raw system prompt)
- Add /thinking toggle to show or hide the reasoning panel
- Add token usage tracking and /usage command
- Add config hardening: temperature validation, finite-number guard, null/string → unset
