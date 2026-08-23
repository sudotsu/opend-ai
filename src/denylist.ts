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
  /\bmkfs\b/i,
  /\bdd\b.*\bof=\/dev\//i,
  // tee writes to its operands. Excluding "<" keeps input redirection
  // (`tee < /dev/sda`, a read) from looking like a write.
  new RegExp(String.raw`\btee\b[^<]*\s${DEVICE}`, 'i'),
  // cp's destination is its final operand; a device anywhere else is a source.
  new RegExp(String.raw`\bcp\s.*\s${DEVICE}\S*\s*$`, 'i'),
  // `>|` is bash's noclobber override; it is a redirect, not a pipe.
  new RegExp(String.raw`>\|?\s*${DEVICE}`, 'i'),
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

    // `>|` overrides noclobber: the bar belongs to the redirect, not to a pipe.
    if (ch === '|' && current.endsWith('>')) { current += ch; continue; }

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

// Git global options that take their operand as a separate token.
const GIT_OPTIONS_WITH_OPERAND = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix'
]);

// `git clean` removes untracked files only when a force flag is present AND no
// dry-run flag overrides it — `-nfd` prints what it would delete rather than
// deleting. Options may also carry their operand as a separate token
// (`--git-dir /repo clean -f`).
//
// This is tokenized rather than pattern-matched because the regex it replaces
// got both wrong, and matched `\bgit\s+` against the "git" inside the path
// /repo/.git — treating a path fragment as the command.
export function isForcedGitClean(segment: string): boolean {
  const tokens = segment.trim().split(/\s+/).filter(Boolean);
  let i = tokens.indexOf('git');
  if (i === -1) return false;

  for (i++; i < tokens.length && tokens[i] !== 'clean'; ) {
    const token = tokens[i];
    if (GIT_OPTIONS_WITH_OPERAND.has(token)) { i += 2; continue; }
    if (token.startsWith('-')) { i += 1; continue; }
    return false; // a bare word before `clean` means this is another subcommand
  }
  if (tokens[i] !== 'clean') return false;

  let force = false;
  let dryRun = false;
  for (i++; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '--') break; // everything after this is a pathspec
    if (token === '--force') { force = true; continue; }
    if (token === '--dry-run') { dryRun = true; continue; }
    if (token.startsWith('--')) continue;
    if (/^-[a-z]+$/i.test(token)) {
      if (token.includes('f')) force = true;
      if (token.includes('n')) dryRun = true;
    }
  }
  return force && !dryRun;
}

// Checks that need real tokens rather than a pattern. Unlike CATASTROPHIC these
// run only against normalized segments, where quoting has already been resolved.
const SEGMENT_CHECKS: Array<(segment: string) => boolean> = [isForcedGitClean];

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
  const segments = normalizeSegments(command);
  const candidates = [command, ...segments];
  const matched = candidates.some(
    (candidate) =>
      CATASTROPHIC.some((re) => re.test(candidate)) || extra.some((re) => re.test(candidate))
  );
  return matched || segments.some((segment) => SEGMENT_CHECKS.some((check) => check(segment)));
}
