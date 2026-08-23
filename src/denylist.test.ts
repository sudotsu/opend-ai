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
    'rm -rf "$HOME"',
    'rm -rf ${HOME}',
    'rm -rf ~/',
    'rm -rf /*',
    'rm -rf ./*',
    'find / -name "*.tmp" -delete',
    'git clean -fdx',
    'git clean --force',
    'mkfs.ext4 /dev/sda',
    'dd if=/dev/zero of=/dev/sda',
    'tee /dev/sda < payload',
    'cp img.bin /dev/nvme0n1',
    // Quoted $HOME still expands; quoted device paths are still operands.
    'rm -rf "$HOME/"',
    'find "$HOME/" -delete',
    'tee "/dev/sda"',
    'cp image.bin "/dev/sda"',
    // Block devices beyond SCSI/NVMe: virtio, Xen, eMMC, device-mapper.
    'cp img.bin /dev/vda',
    'tee /dev/xvda < x',
    'cp img.bin /dev/mmcblk0',
    'tee /dev/mapper/vg-root < x',
    'echo x > /dev/vda',
    // git global options may precede the subcommand.
    'git -C /repo clean -fd',
    'git -c core.x=1 clean -f',
    // Compound commands: a trailing operator must not hide the destructive part.
    'cd /tmp && rm -rf $HOME',
    'cp img.bin /dev/sda && sync',
    'echo hi; rm -rf ~',
    'make || rm -rf $HOME',
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
    'rm -rf node_modules/.cache',
    // Home SUBPATHS are routine; only the home root itself is catastrophic.
    // Prompting on these would train users to click through the root case.
    'rm -rf ~/projects/app/node_modules',
    'rm -rf $HOME/.cache/tmp',
    // find is only catastrophic when rooted at / or home, not any absolute path.
    'find /tmp/build -name "*.o" -delete',
    'find . -name "*.log" -delete',
    // git clean cannot delete without -f/--force; -n is a dry run.
    'git clean -n',
    'git clean --dry-run',
    'git clean -n -- my-file',
    // Reading a block device is safe; only writing to one is destructive.
    'cat /dev/sda > /mnt/backup/disk.img',
    'cp /dev/sdb.img ./backup',
    'ls -l /dev/sda',
    'lsblk | cat',
    // Quoted ~ is a literal directory name, not the home directory.
    'rm -rf "~"',
    "rm -rf '~'",
    'find "~" -delete',
    // Single quotes suppress expansion: this removes a file named $HOME.
    "rm -rf '$HOME'",
    // Input redirection reads from the device.
    'tee < /dev/sda',
    // A dangerous string mentioned inside quotes is an argument, not a command.
    'echo "rm -rf /" >> notes.txt'
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
