# Security and Reliability

## Threat-relevant surfaces and trust boundaries

The principal boundaries are repository content, repository-local configuration, user-global credentials/configuration, model output, file tools, shell execution, provider egress, and persistent sessions/checkpoints. The audited revision meaningfully hardens path handling, protected reads, edit approvals, dangerous command matching, and fail-closed sandbox selection.

The largest remaining trust flaw is SEC-005. A cloned repository can choose `baseUrl` while the user's environment or home supplies the credential, so the first request can send that credential to a repository-selected endpoint. The same project file can lower approval posture, and string `"false"` is treated as truthy. `.opendrc.json` is not model-read-protected even though the documented home form may hold an API key.

## Secrets, data, authentication, authorization, and egress

The audit never inspected, printed, copied, or modified the configured Venice credential. It was consumed only through opend-ai's normal configuration path in one disposable workflow. Retained evidence is sanitized and uses synthetic values for security diagnostics.

Session storage is mode-restricted and performs recursive redaction, but a synthetic `VENICE_API_KEY=...` assignment remained unchanged (PRIV-001). Checkpoints use a mode-0700 root, yet copy gitignored `.env` content and retain it indefinitely (REL-005). These are local-exposure issues, not evidence that the real credential was persisted during this audit.

Provider egress is inherent to the product. The current endpoint/credential trust partition is insufficient, and the provider acceptance matrix is incomplete (PROD-002). Any future security-lab use requires an explicit authorized target, model/provider, evidence policy, data handling, and audit contract (SEC-006).

## Unsafe defaults, containment, and destructive behavior

The default is intended to be workspace-write, network-off Bubblewrap containment, with an explicitly named unsafe-host profile and no silent host fallback. That policy is correct. Its functional probe is not: it mounts `/usr` and tries a dynamically linked `/usr/bin/true` without the runtime-library mounts that the actual sandbox builder supplies. The probe fails, while a harmless diagnostic using the real system-mount pattern succeeds (SEC-002).

Consequently, the default profile cannot run any command on the audited WSL environment. This is a conclusive product defect and blocks positive verification that workspace writes succeed, outside-workspace writes fail, and network is off/on according to policy. Choosing unsafe-host would evade the requirement and was not used as a substitute.

Command denylist and approval tests are valuable but are not a technical boundary. Repository-controlled bypass posture compounds that risk (SEC-005). File-tool protections are stronger than the previous baseline, though configuration files containing authority or credentials need inclusion.

## Failure containment, recovery, portability, and operational risk

The refused-endpoint workflow demonstrated bounded retry and nonzero termination. Malformed configuration and EOF fail cleanly. The live command failure was explicit and did not fall back to the host. Diff and undo restored the disposable edit.

Reliability remains provisional because secure execution is blocked, native Windows behavior on a supported runtime was unavailable, and Ollama/generic endpoints were not run end to end (REL-002, PROD-002). Automatic checkpoint scope can create latency and disk pressure, and special filenames lose diff preview (REL-005, UX-008). The package is buildable but has no current release/update lifecycle (REL-004).

## Specialized testing still required

To complete the teardown, repair and positively verify SEC-002 on supported Linux/WSL; prove inside-workspace write, outside-workspace denial, network-off default, network opt-in, bounded timeout, cancellation, and no host fallback. Then run one bounded end-to-end workflow for each claimed provider class, plus native Windows on Node 22 or 24 if Windows remains supported. Exercise checkpoint quotas/cleanup, session redaction, trusted/untrusted config transitions, quoted paths, layered ignores, and package upgrades. The security-lab profile remains blocked until the owner supplies an approved engagement manifest rather than an abstract claim (SEC-006).
