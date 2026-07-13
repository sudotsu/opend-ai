import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { buildApprovalPreview } from './preview.js';
import { createToolPolicy } from './tools.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('approval previews', () => {
  it('labels create/overwrite/edit and displays proposed content', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-preview-')); dirs.push(dir);
    const policy = createToolPolicy({ workspaceRoot: dir });
    expect(buildApprovalPreview('write_file', { path: 'a.txt', content: 'new' }, policy)).toMatchObject({ safe: true, operation: 'create' });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'old');
    expect(buildApprovalPreview('write_file', { path: 'a.txt', content: 'new' }, policy).text).toContain('+new');
    expect(buildApprovalPreview('edit_file', { path: 'a.txt', old_string: 'old', new_string: 'new' }, policy).text).toContain('-old');
  });

  it('fails safely when a bounded text preview is impossible', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-preview-')); dirs.push(dir);
    const policy = createToolPolicy({ workspaceRoot: dir });
    expect(buildApprovalPreview('write_file', { path: 'a', content: '\0binary' }, policy).safe).toBe(false);
  });
});
