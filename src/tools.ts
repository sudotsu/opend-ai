import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';

export function resolvePath(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return path.resolve(filePath);
}

// 1. Read File Tool
export function readFile(filePath: string, startLine?: number, endLine?: number): string {
  const absolutePath = resolvePath(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');

  // Truncate large files when reading without line range
  const MAX_CHARS = 20000;
  if (startLine === undefined && endLine === undefined && content.length > MAX_CHARS) {
    return content.substring(0, MAX_CHARS) +
      '\n[Truncated: file is ' + content.length + ' chars. Use startLine/endLine to read specific sections.]';
  }

  if (startLine !== undefined || endLine !== undefined) {
    const lines = content.split('\n');
    const start = startLine ? startLine - 1 : 0;
    const end = endLine ? endLine : lines.length;
    return lines.slice(start, end).join('\n');
  }
  return content;
}

// 2. Write File Tool
export function writeFile(filePath: string, content: string): string {
  const absolutePath = resolvePath(filePath);
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absolutePath, content, 'utf-8');
  return 'Successfully wrote to ' + filePath;
}

// 3. Edit File Tool
export function editFile(filePath: string, oldString: string, newString: string): string {
  const absolutePath = resolvePath(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('File not found: ' + filePath);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');

  // Count occurrences
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const idx = content.indexOf(oldString, searchFrom);
    if (idx === -1) break;
    count++;
    searchFrom = idx + oldString.length;
  }

  if (count === 0) {
    return 'Error: old_string not found in ' + filePath;
  }
  if (count > 1) {
    return 'Error: old_string is ambiguous (' + count + ' matches found) — provide more surrounding context to make it unique.';
  }

  const matchIndex = content.indexOf(oldString);
  const lineNumber = content.substring(0, matchIndex).split('\n').length;
  const newContent = content.replace(oldString, newString);
  fs.writeFileSync(absolutePath, newContent, 'utf-8');
  return 'Successfully edited ' + filePath + ' at line ' + lineNumber;
}

// 4. List Directory Tool
export function listDir(dirPath: string): string {
  const absolutePath = resolvePath(dirPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Directory not found: ' + dirPath);
  }
  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory: ' + dirPath);
  }
  const items = fs.readdirSync(absolutePath);
  const result = items.map(item => {
    const itemPath = path.join(absolutePath, item);
    const itemStats = fs.statSync(itemPath);
    return {
      name: item,
      type: itemStats.isDirectory() ? 'directory' : 'file',
      sizeBytes: itemStats.isFile() ? itemStats.size : undefined
    };
  });
  return JSON.stringify(result, null, 2);
}

// 5. Run Command Tool
export function runCommand(command: string, timeoutMs: number = 30000): Promise<string> {
  // Node's exec disables the timeout entirely for 0/negative/non-finite values,
  // which would let a hung command block the agent forever. Floor to a safe
  // minimum so the hard timeout can never be silently removed.
  const effectiveTimeout =
    Number.isFinite(timeoutMs) && timeoutMs >= 1000 ? timeoutMs : 30000;
  return new Promise((resolve) => {
    exec(command, { timeout: effectiveTimeout }, (error, stdout, stderr) => {
      let output = '';
      if (stdout) output += 'STDOUT:\n' + stdout + '\n';
      if (stderr) output += 'STDERR:\n' + stderr + '\n';
      if (error) {
        if (error.killed) {
          resolve(`Command timed out after ${Math.round(effectiveTimeout / 1000)} seconds.`);
          return;
        }
        output += 'ERROR: ' + error.message + '\n';
        resolve(output);
      } else {
        resolve(output || 'Command executed successfully with no output.');
      }
    });
  });
}

// 6. Grep Search Tool (Recursive text search)
export function grepSearch(pattern: string, searchPath: string): string {
  const absolutePath = resolvePath(searchPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Path not found: ' + searchPath);
  }

  const matches: { file: string; lineNumber: number; lineContent: string }[] = [];
  const regex = new RegExp(pattern, 'i');

  function traverse(currentPath: string) {
    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      const baseName = path.basename(currentPath);
      if (baseName === 'node_modules' || baseName === '.git' || baseName === 'dist') {
        return;
      }
      const files = fs.readdirSync(currentPath);
      for (const file of files) {
        traverse(path.join(currentPath, file));
      }
    } else if (stats.isFile()) {
      try {
        const content = fs.readFileSync(currentPath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            matches.push({
              file: path.relative(process.cwd(), currentPath),
              lineNumber: index + 1,
              lineContent: line.trim()
            });
          }
        });
      } catch {
        // Skip binary files or unreadable files
      }
    }
  }

  traverse(absolutePath);
  return JSON.stringify(matches.slice(0, 100), null, 2);
}
