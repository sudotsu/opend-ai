import chalk from 'chalk';

export const pink = chalk.hex('#ff7ac6');

// Chunks worth pinking inside a line of reasoning: `backticked` and "quoted"
// spans, the agent's own tool names, and file/path-ish tokens (has a slash or a
// known code extension). Matched on whole lines, so split-across-chunk names are
// already reassembled by the time this runs.
export const THINK_HIGHLIGHT =
  /(`[^`]+`|"[^"]+"|\b(?:read_file|write_file|edit_file|list_dir|run_command|grep_search)\b|\b[\w.\/-]*\/[\w.\/-]+\b|\b[\w-]+\.(?:ts|tsx|js|jsx|json|md|py|sh|ya?ml|txt|css|html)\b)/g;

// Styles one complete line of reasoning: dim + italic base, pink highlights.
export function styleThinkingLine(line: string): string {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(THINK_HIGHLIGHT)) {
    const start = m.index ?? 0;
    out += chalk.dim.italic(line.slice(last, start));
    out += pink(m[0]);
    last = start + m[0].length;
  }
  out += chalk.dim.italic(line.slice(last));
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
