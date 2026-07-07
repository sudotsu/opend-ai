import chalk from 'chalk';

// ── Theme ──────────────────────────────────────────────────────────────────
// One place to retune every color in the UI. Each field is a chalk instance,
// so callers can chain (`theme.tool.bold(...)`). Swap a hex here and it changes
// everywhere that color is used — the thinking stream, tool headers, and labels
// in index.ts all import from this object.
export const theme = {
  path:     chalk.hex('#8fe388'),              // pale green — file paths
  tool:     chalk.hex('#5ccfe6'),              // cyan — tool names / activity
  quote:    chalk.hex('#ff7ac6'),              // pink — quoted & backticked spans
  num:      chalk.hex('#ffd580'),              // amber — bare numbers
  url:      chalk.hex('#82aaff').underline,    // blue underline — full URLs
  constant: chalk.hex('#ff966c'),              // orange — CONSTANT_CASE / env vars
  flag:     chalk.hex('#c099ff'),              // violet — CLI flags (--flag, -f)
  base:     chalk.dim                          // dim gray — ordinary reasoning text
};

// Back-compat: `pink` is still imported by index.ts and tests. It's the quote color.
export const pink = theme.quote;

const TOOL_NAME = /^(?:read_file|write_file|edit_file|list_dir|run_command|grep_search)$/;

// Which theme color a highlighted token gets, by what kind of token it is.
function colorFor(token: string): (s: string) => string {
  if (/^`.*`$/.test(token) || /^".*"$/.test(token)) return theme.quote;
  if (/^https?:\/\//.test(token)) return theme.url;
  if (TOOL_NAME.test(token)) return theme.tool;
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(token)) return theme.constant;
  if (/^--?[a-z]/.test(token)) return theme.flag;
  if (/^\d[\d,.]*$/.test(token)) return theme.num;
  return theme.path; // file/path-ish
}

// Chunks worth highlighting inside a line of reasoning: `backticked` and "quoted"
// spans, URLs, the agent's own tool names, file/path-ish tokens (has a slash or a
// known code extension), and bare numbers. Matched on whole lines, so
// split-across-chunk names are already reassembled by the time this runs. URLs
// come first so a full http(s) link is taken whole instead of its path tail.
export const THINK_HIGHLIGHT =
  /(https?:\/\/[^\s)]+|`[^`]+`|"[^"]+"|\b(?:read_file|write_file|edit_file|list_dir|run_command|grep_search)\b|\b[\w.\/-]*\/[\w.\/-]+\b|\b[\w-]+\.(?:ts|tsx|js|jsx|json|md|py|sh|ya?ml|txt|css|html)\b|\b[A-Z][A-Z0-9_]{2,}\b|(?<![\w-])--?[a-z][\w-]*|\b\d[\d,.]*\b)/g;

// Styles one complete line of reasoning: dim gray base text, with each
// highlighted token colored by its kind (path = green, tool = cyan, quote = pink).
export function styleThinkingLine(line: string): string {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(THINK_HIGHLIGHT)) {
    const start = m.index ?? 0;
    out += theme.base(line.slice(last, start));
    out += colorFor(m[0])(m[0]);
    last = start + m[0].length;
  }
  out += theme.base(line.slice(last));
  return out;
}

// Compact one-line summary of a tool call's arguments for the activity display.
export function summarizeArgs(name: string, args: any): string {
  if (!args) return '';
  if (name === 'run_command') return args.command ?? '';
  if (name === 'grep_search') return `/${args.pattern}/ in ${args.path ?? '.'}`;
  if (args.path) return args.path;
  return '';
}
