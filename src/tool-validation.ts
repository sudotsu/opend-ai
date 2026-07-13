export interface ValidatedToolCall {
  name: string;
  args: Record<string, unknown>;
}

const MAX_PATH = 4096;
const MAX_CONTENT = 1_000_000;
const MAX_COMMAND = 32_000;
const MAX_PATTERN = 1_000;

/**
 * Validates and returns a JSON object containing tool arguments.
 *
 * @param value - The value to validate as a JSON object
 * @returns The validated arguments object
 */
function objectArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('arguments must be a JSON object');
  }
  return value as Record<string, unknown>;
}

/**
 * Validates and returns a string argument with optional emptiness and length constraints.
 *
 * @param args - The arguments object containing the value.
 * @param key - The key of the value to validate.
 * @param options - Validation options for allowing empty strings and setting the maximum length.
 * @returns The validated string.
 * @throws Error If the value is not a string, is empty when empty strings are disallowed, or exceeds the character limit.
 */
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

/**
 * Validates an optional line number argument.
 *
 * @param args - The arguments object containing the value.
 * @param key - The name of the line number argument.
 * @returns The validated line number, or `undefined` when the argument is absent.
 */
function line(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 1_000_000) {
    throw new Error(`${key} must be an integer between 1 and 1000000`);
  }
  return value as number;
}

/**
 * Validates a raw tool invocation and returns its normalized arguments.
 *
 * @param name - The tool name used to select the expected arguments.
 * @param raw - The raw arguments value to validate.
 * @returns The validated tool name and arguments.
 * @throws Error if the arguments are invalid or the tool name is unknown.
 */
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
