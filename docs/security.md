# Security model

Approvals and warning regexes are user decisions and defense in depth; neither is a technical boundary.

The default `sandbox` profile restricts model file tools to the selected workspace, blocks common secret-bearing paths, and runs shell commands through Bubblewrap with only minimal runtime/toolchain paths mounted read-only, the workspace writable, and network namespaces isolated. Host home/root data is not mounted. If Bubblewrap is missing or unusable, command execution fails closed. It never falls back to the host shell.

Native Windows currently fails closed for secure command execution. Use WSL or a supported container. The expert-only `--profile unsafe-host` option must be selected explicitly for that invocation, adds a persistent prompt/banner warning, and can affect the entire machine.

`--allow-network` is an explicit transition that shares network access with sandboxed commands. It is off by default. Model output remains uncensored in every profile; the policy governs tools and effects only.

Session files contain model conversations and tool results. New files use restrictive permissions where supported, common credential patterns are redacted, retention defaults to 30 days, and `/delete-session` removes a named session. Ordinary filesystem deletion cannot promise physical-media erasure.
