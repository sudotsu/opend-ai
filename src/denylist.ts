// Defense-in-depth warning patterns. These are intentionally NOT a security
// boundary: shell syntax is too flexible for a regex blocklist to be exhaustive.
// Workspace/process/network containment is enforced independently by ToolPolicy.

export const CATASTROPHIC: RegExp[] = [
  /\brm\s+(-[a-z]*\s+)*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b.*\s(\/|~|\/\*|\.\/\*|\$HOME)\s*$/i,
  /\brm\s+-[a-z]*r[a-z]*f?\s+\/(\s|$)/i,
  // Home ROOT only. Deeper paths (~/proj/node_modules) are routine and would
  // train users to click through the prompt that protects the root case.
  /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f?[a-z]*\s+["']?(\$\{?HOME\}?|~)["']?\/?\s*$/i,
  /\bfind\s+["']?(\/|~|\$\{?HOME\}?)["']?\/?\s(?:[^|;&]*\s)?-delete\b/i,
  /\bgit\s+clean\b[^|;&]*\s(-[a-z]*f[a-z]*|--force)(\s|$)/i,  // -f/--force is what deletes
  /\bmkfs\b/i,
  /\bdd\b.*\bof=\/dev\//i,
  /\btee\b[^|;&]*\s\/dev\/(sd|nvme|hd|disk)/i,      // tee writes to its arguments
  /\bcp\s[^|;&]*\s\/dev\/(sd|nvme|hd|disk)\S*\s*$/i, // cp destination is the last arg
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
