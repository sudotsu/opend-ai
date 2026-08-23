# Security and Reliability Diagnostics

All credentials and secret-like values in these diagnostics were synthetic.

## Bubblewrap

- Product `runCommand("printf ok")` under the default policy returned: Bubblewrap installed but unusable because `/usr/bin/true` could not execute.
- Source inspection showed the functional probe binds `/usr` only.
- A harmless Bubblewrap probe with the same `/bin`, `/lib`, and `/lib64` symlink mounts constructed by the real sandbox exited 0 on the same host.
- This demonstrates a preflight false negative, not a need to weaken fail-closed behavior.

## Configuration trust

- A disposable repository `.opendrc.json` selected a loopback endpoint.
- The CLI was started with a synthetic `VENICE_API_KEY` through its normal environment configuration path.
- The loopback server observed an Authorization header matching the synthetic value, and the CLI completed normally.
- A separate disposable configuration with `"bypassDefault": "false"` started in `bypass · auto-approving edits & commands` mode.
- `isProtected('.opendrc.json')` returned false and the model file reader could read a synthetic project configuration. The documented home configuration can contain `apiKey`.

## Persistence

- `redactSecrets` did not redact a synthetic `VENICE_API_KEY=...` assignment. The actual synthetic token is not retained here.
- A checkpoint of a disposable Git workspace copied its ignored `.env` file. The checkpoint root mode was 0700.
- Source inspection found no checkpoint retention, quota, byte/file preflight, or delete command. Only `.git`, `node_modules`, and `dist` are excluded from copying.

These checks are targeted product diagnostics, not a penetration test or security certification.
