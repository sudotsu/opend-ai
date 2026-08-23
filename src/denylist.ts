// Defense-in-depth warning patterns. These are intentionally NOT a security
// boundary: shell syntax is too flexible for a regex blocklist to be exhaustive.
// Workspace/process/network containment is enforced independently by ToolPolicy.

// Raw block devices. Writing to one destroys a disk regardless of filesystem:
// SCSI/SATA, NVMe, IDE, virtio (KVM), Xen, SD/eMMC, and device-mapper (LVM/LUKS).
const DEVICE = String.raw`\/dev\/(?:sd|nvme|hd|vd|xvd|mmcblk|disk|mapper)`;

export const CATASTROPHIC: RegExp[] = [
  // No $HOME alternative: normalization rewrites a real home reference to `~`,
  // so a surviving literal "$HOME" was single-quoted and does not expand.
  /\brm\s+(-[a-z]*\s+)*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b.*\s(\/|~|\/\*|\.\/\*)\s*$/i,
  /\brm\s+-[a-z]*r[a-z]*f?\s+\/(\s|$)/i,
  // Home ROOT only. Deeper paths (~/proj/node_modules) are routine and would
  // train users to click through the prompt that protects the root case.
  // `~` here is post-normalization: it means the shell would really expand it.
  /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f?[a-z]*\s+~\/?\s*$/i,
  /\bfind\s+(\/|~)\/?\s(?:[^|;&]*\s)?-delete\b/i,
  // Global options (-C /repo, -c k=v, --git-dir=...) may sit between git and the
  // subcommand. -f/--force must be a whitespace-delimited flag, not the "-f"
  // inside a hyphenated filename.
  /\bgit\s+(?:-[cC]\s+\S+\s+|-\S+\s+)*clean\b[^|;&]*\s(-[a-z]*f[a-z]*|--force)(\s|$)/i,
  /\bmkfs\b/i,
  /\bdd\b.*\bof=\/dev\//i,
  // tee writes to its operands. Excluding "<" keeps input redirection
  // (`tee < /dev/sda`, a read) from looking like a write.
  new RegExp(String.raw`\btee\b[^<]*\s${DEVICE}`, 'i'),
  // cp's destination is its final operand; a device anywhere else is a source.
  new RegExp(String.raw`\bcp\s.*\s${DEVICE}\S*\s*$`, 'i'),
  new RegExp(String.raw`>\s*${DEVICE}`, 'i'),
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,          // fork bomb
  /\bformat\b\s+[a-z]:/i,                           // Windows format C:
  /\bdel\b.*\/[sqf]/i,                              // Windows recursive/force delete
  /\b(shutdown|reboot|halt|poweroff)\b/i
];

// Splits a command line on unquoted shell operators and resolves the home
// shorthands a shell would actually expand, so a destructive command is still
// seen when it is not the last thing on the line and when quoting hides it.
//
// Expansion rules mirror POSIX shells: $HOME and ${HOME} expand unquoted and
// inside double quotes, but not inside single quotes; ~ expands only unquoted.
// A quoted tilde is an ordinary filename, so it becomes a placeholder filename
// rather than being silently unquoted into a home reference.
export function normalizeSegments(command: string): string[] {
  const homeVar = /^\$\{?HOME\}?/;
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let quoted = '';

  // A quoted run containing whitespace is a string argument, not a path — its
  // contents must not be re-read as command text, or `echo "rm -rf /" > notes`
  // would look like the command it merely mentions. Such runs collapse to a
  // single opaque token; whitespace-free runs unquote so that "$HOME" and
  // "/dev/sda" still match as the operands they are.
  const closeQuote = (): string => {
    if (/\s/.test(quoted)) return '_';
    if (quote === "'") return quoted;           // single quotes suppress expansion
    return quoted.replace(homeVar, '~');
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (quote) {
      if (ch === quote) { current += closeQuote(); quoted = ''; quote = null; continue; }
      quoted += ch === '~' ? '_' : ch;
      continue;
    }

    if (ch === '"' || ch === "'") { quote = ch; quoted = ''; continue; }

    if (ch === ';' || ch === '\n' || ch === '|' || ch === '&') {
      if ((ch === '|' || ch === '&') && command[i + 1] === ch) i++;
      segments.push(current);
      current = '';
      continue;
    }

    if (ch === '$') {
      const match = homeVar.exec(command.slice(i));
      if (match) { current += '~'; i += match[0].length - 1; continue; }
    }

    current += ch;
  }

  if (quote) current += closeQuote();   // unterminated quote: treat as closed
  segments.push(current);
  return segments.filter((segment) => segment.trim().length > 0);
}

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
  // The raw line is still checked alongside the segments: some patterns (the
  // fork bomb) are defined in terms of the very operators segmentation splits on.
  const candidates = [command, ...normalizeSegments(command)];
  return candidates.some(
    (candidate) =>
      CATASTROPHIC.some((re) => re.test(candidate)) || extra.some((re) => re.test(candidate))
  );
}
