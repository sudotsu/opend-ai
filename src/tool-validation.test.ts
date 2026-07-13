import { describe, it, expect } from 'vitest';
import { validateToolCall } from './tool-validation.js';

describe('runtime tool validation', () => {
  it('rejects the empty edit search before I/O', () => {
    expect(() => validateToolCall('edit_file', { path: 'a', old_string: '', new_string: 'x' })).toThrow(/must not be empty/);
  });

  it('rejects invalid ranges, types, unknown tools, and oversized commands', () => {
    expect(() => validateToolCall('read_file', { path: 'a', startLine: 3, endLine: 2 })).toThrow(/must not exceed/);
    expect(() => validateToolCall('write_file', { path: 'a', content: 1 })).toThrow(/content must be a string/);
    expect(() => validateToolCall('run_command', { command: 'x'.repeat(32001) })).toThrow(/limit/);
    expect(() => validateToolCall('made_up', {})).toThrow(/unknown tool/);
  });
});
