import { describe, it, expect } from 'vitest';
import { isCatastrophic, compileExtraDenylist } from './denylist.js';

const call = (command: string) => isCatastrophic('run_command', { command });

describe('isCatastrophic', () => {
  it('only applies to run_command', () => {
    expect(isCatastrophic('write_file', { path: '/etc/passwd' })).toBe(false);
  });

  it('ignores calls with no command argument', () => {
    expect(isCatastrophic('run_command', {})).toBe(false);
    expect(isCatastrophic('run_command', undefined)).toBe(false);
  });

  const shouldBlock = [
    'rm -rf /',
    'sudo rm -rf /',
    'rm -rf ~',
    'rm -rf /*',
    'rm -rf ./*',
    'mkfs.ext4 /dev/sda',
    'dd if=/dev/zero of=/dev/sda',
    'cat /dev/zero > /dev/sda',
    ':(){ :|:& };:',
    'format C:',
    'del /s /q C:\\Windows',
    'shutdown now',
    'reboot'
  ];

  it.each(shouldBlock)('flags catastrophic command: %s', (cmd) => {
    expect(call(cmd)).toBe(true);
  });

  const shouldPass = [
    'rm -rf node_modules',
    'rm -rf ./dist',
    'rm file.txt',
    'npm run build',
    'git commit -m "x"',
    'ls -la /',
    'grep -r foo .',
    'information about format',
    'model del test',
    'tsc --noEmit',
    'rm -rf node_modules/.cache'
  ];

  it.each(shouldPass)('does not flag ordinary command: %s', (cmd) => {
    expect(call(cmd)).toBe(false);
  });

  it('also checks extra denylist patterns when provided', () => {
    const extra = compileExtraDenylist(['\\bmy-dangerous-tool\\b']);
    expect(isCatastrophic('run_command', { command: 'my-dangerous-tool --go' }, extra)).toBe(true);
    expect(isCatastrophic('run_command', { command: 'ls' }, extra)).toBe(false);
  });
});

describe('compileExtraDenylist', () => {
  it('compiles valid regex source strings', () => {
    const patterns = compileExtraDenylist(['foo', 'bar\\d+']);
    expect(patterns).toHaveLength(2);
    expect(patterns[0].test('foo')).toBe(true);
    expect(patterns[1].test('bar42')).toBe(true);
  });

  it('skips invalid regex sources without throwing', () => {
    const patterns = compileExtraDenylist(['valid', '(unterminated']);
    expect(patterns).toHaveLength(1);
  });
});
