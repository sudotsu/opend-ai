import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { describe, it, expect } from 'vitest';
import { VeniceAgent } from './agent.js';
import { createToolPolicy } from './tools.js';

describe('deterministic OpenAI-compatible provider loop', () => {
  it('streams a tool call, receives its result, and completes', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-provider-'));
    fs.writeFileSync(path.join(workspace, 'package.json'), '{"name":"fixture"}');
    const requests: any[] = [];
    let turn = 0;
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        requests.push(JSON.parse(raw));
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        if (turn++ === 0) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'read_file', arguments: '{"path":"package.json"}' } }] } }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'mock complete' } }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
        }
        res.end('data: [DONE]\n\n');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server did not bind');
    try {
      const agent = new VeniceAgent({
        apiKey: '',
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: 'mock-model',
        maxRetries: 0,
        toolPolicy: createToolPolicy({ workspaceRoot: workspace })
      });
      await expect(agent.chat('inspect the fixture')).resolves.toBe('mock complete');
      expect(requests).toHaveLength(2);
      expect(requests[0].stream_options).toBeUndefined();
      expect(requests[1].messages.some((message: any) => message.role === 'tool' && message.content.includes('fixture'))).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
