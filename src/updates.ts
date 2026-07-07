import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import { theme } from './render.js';

// Pure: parses raw CHANGELOG.md markdown and returns a theme-colored string.
// Dates become bold tool-colored headings; bullets use dim base text.
export function formatChangelog(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      out.push('\n' + chalk.bold(theme.tool(line.slice(3))));
    } else if (line.startsWith('- ')) {
      out.push(theme.base('  • ' + line.slice(2)));
    }
    // Skip the # title line and blank separators — they add noise in a CLI pager.
  }
  return out.join('\n').trimStart();
}

// Reads CHANGELOG.md relative to the package root (dist/../CHANGELOG.md), so it
// works after `npm install -g` regardless of the user's cwd. Returns '' on error.
export function loadChangelog(): string {
  const changelogPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'CHANGELOG.md'
  );
  try {
    return readFileSync(changelogPath, 'utf8');
  } catch {
    return '';
  }
}
