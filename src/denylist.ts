// Defense-in-depth warning patterns. These are intentionally NOT a security
// boundary: shell syntax is too flexible for a regex blocklist to be exhaustive.
// Workspace/process/network containment is enforced independently by ToolPolicy.

export const CATASTROPHIC: RegExp[] = [
  /\brm\s+(-[a-z]*\s+)*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b.*\s(\/|~|\/\*|\.\/\*|\$HOME)\s*$/i,
  /\brm\s+-[a-z]*r[a-z]*f?\s+\/(\s|$)/i,
  /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f?[a-z]*\s+(\$\{?HOME\}?|"(\$\{?HOME\}?|~)"|'(\$\{?HOME\}?|~)'|~)(\/|\s|$)/i,
  /\bfind\s+(\/|~|\$\{?HOME\}?).*\s-delete\b/i,
  /\bgit\s+clean\b.*-[a-z]*f/i,                     // git clean needs -f to delete
  /\bmkfs\b/i,
  /\bdd\b.*\bof=\/dev\//i,
  /\b(tee|cat|cp)\b.*\/dev\/(sd|nvme|hd|disk)/i,
  />\s*\/dev\/(sd|nvme|hd|disk)/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,          // fork bomb
  /\bformat\b\s+[a-z]:/i,                           // Windows format C:
  /\bdel\b.*\/[sqf]/i,                              // Windows recursive/force delete
  /\b(shutdown|reboot|halt|poweroff)\b/i
];

// Compiles user-supplied config strings (from `extraDenylist`) into RegExps.
// Invalid patterns are skipped with a console warning rather than crashing startup.
export function compileExtraDenylist(sources: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const src of sources) {
    try {
      out.push(new RegExp(src, 'i'));
    } catch (err: any) {
      console.error(`Warning: invalid extraDenylist pattern "${src}": ${err.message}`);
    }
  }
  return out;
}

export function isCatastrophic(
  name: string,
  args: any,
  extra: RegExp[] = []
): boolean {
  if (name !== 'run_command' || !args?.command) return false;
  const command = String(args.command);
  return CATASTROPHIC.some((re) => re.test(command)) || extra.some((re) => re.test(command));
}
