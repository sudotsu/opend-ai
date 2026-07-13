export interface ValidatedToolCall {
  name: string;
  args: Record<string, unknown>;
}

const MAX_PATH = 4096;
const MAX_CONTENT = 1_000_000;
const MAX_COMMAND = 32_000;
const MAX_PATTERN = 1_000;

function objectArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('arguments must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function text(
  args: Record<string, unknown>,
  key: string,
  options: { allowEmpty?: boolean; max?: number } = {}
): string {
  const value = args[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  if (!options.allowEmpty && value.length === 0) throw new Error(`${key} must not be empty`);
  if (value.length > (options.max ?? MAX_PATH)) {
    throw new Error(`${key} exceeds the ${(options.max ?? MAX_PATH).toLocaleString()} character limit`);
  }
  return value;
}

function line(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 1_000_000) {
    throw new Error(`${key} must be an integer between 1 and 1000000`);
  }
  return value as number;
}

export function validateToolCall(name: string, raw: unknown): ValidatedToolCall {
  const args = objectArgs(raw);
  switch (name) {
    case 'read_file': {
      const startLine = line(args, 'startLine');
      const endLine = line(args, 'endLine');
      if (startLine && endLine && startLine > endLine) throw new Error('startLine must not exceed endLine');
      return { name, args: { path: text(args, 'path'), startLine, endLine } };
    }
    case 'write_file':
      return { name, args: { path: text(args, 'path'), content: text(args, 'content', { allowEmpty: true, max: MAX_CONTENT }) } };
    case 'edit_file':
      return {
        name,
        args: {
          path: text(args, 'path'),
          old_string: text(args, 'old_string', { max: MAX_CONTENT }),
          new_string: text(args, 'new_string', { allowEmpty: true, max: MAX_CONTENT })
        }
      };
    case 'list_dir':
      return { name, args: { path: text(args, 'path') } };
    case 'run_command':
      return { name, args: { command: text(args, 'command', { max: MAX_COMMAND }) } };
    case 'grep_search':
      return { name, args: { pattern: text(args, 'pattern', { max: MAX_PATTERN }), path: text(args, 'path') } };
    default:
      throw new Error(`unknown tool ${JSON.stringify(name)}`);
  }
}
