import fs from 'fs';
import { resolvePath, type ToolPolicy } from './tools.js';

export interface ApprovalPreview {
  safe: boolean;
  operation: 'create' | 'overwrite' | 'edit';
  text: string;
}

const MAX_PREVIEW_CHARS = 20_000;

function binary(text: string): boolean {
  return text.includes('\0');
}

function lines(prefix: string, text: string, maxLines = 80): string {
  const all = text.split('\n');
  const shown = all.slice(0, maxLines).map((line) => `${prefix}${line}`);
  if (all.length > maxLines) shown.push(`… ${all.length - maxLines} more lines omitted`);
  return shown.join('\n');
}

export function buildApprovalPreview(name: string, args: any, policy: ToolPolicy): ApprovalPreview {
  const target = resolvePath(args.path, policy);
  const exists = fs.existsSync(target);
  const current = exists ? fs.readFileSync(target, 'utf-8') : '';
  if (current.length > MAX_PREVIEW_CHARS || binary(current)) {
    return { safe: false, operation: name === 'edit_file' ? 'edit' : 'overwrite', text: 'Refusing approval: existing target is binary or too large for a bounded preview.' };
  }
  if (name === 'edit_file') {
    if (binary(args.new_string) || args.old_string.length + args.new_string.length > MAX_PREVIEW_CHARS) {
      return { safe: false, operation: 'edit', text: 'Refusing approval: proposed edit is binary or too large for a bounded preview.' };
    }
    return { safe: true, operation: 'edit', text: `${lines('-', args.old_string, 60)}\n${lines('+', args.new_string, 60)}` };
  }
  if (binary(args.content) || args.content.length > MAX_PREVIEW_CHARS) {
    return { safe: false, operation: exists ? 'overwrite' : 'create', text: 'Refusing approval: proposed content is binary or too large for a bounded preview.' };
  }
  const operation = exists ? 'overwrite' : 'create';
  const text = exists ? `${lines('-', current, 50)}\n${lines('+', args.content, 50)}` : lines('+', args.content, 100);
  return { safe: true, operation, text };
}
