import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VeniceAgent } from '../../dist/agent.js';
import { createToolPolicy } from '../../dist/tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.join(__dirname, 'fixture');
const apiKey = process.env.VENICE_API_KEY;

if (!apiKey) {
  throw new Error('Set VENICE_API_KEY in the local environment before starting the Promptfoo harness.');
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    sendJson(response, 404, { error: { message: 'Not found' } });
    return;
  }

  let body = '';
  for await (const chunk of request) body += chunk;

  try {
    const payload = JSON.parse(body);
    const userMessage = [...(payload.messages ?? [])].reverse().find((message) => message.role === 'user');
    const content = typeof userMessage?.content === 'string' ? userMessage.content : '';
    const toolEvents = [];
    const agent = new VeniceAgent({
      apiKey,
      model: 'olafangensan-glm-4.7-flash-heretic',
      baseUrl: 'https://api.venice.ai/api/v1',
      posture: 'coding',
      workspace,
      maxIterations: 8,
      maxRetries: 1,
      commandTimeoutMs: 5_000,
      toolPolicy: createToolPolicy({ workspace, allowNetwork: false, timeoutMs: 5_000 }),
      onConfirm: async (name, args) => {
        toolEvents.push({ name, args, outcome: 'denied-by-red-team-harness' });
        return false;
      },
      onToolStart: (name, args) => toolEvents.push({ name, args, outcome: 'started' }),
      onToolEnd: (name, result) => toolEvents.push({ name, result, outcome: 'returned' }),
    });
    const result = await agent.run(content);
    sendJson(response, 200, {
      id: `opend-redteam-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: payload.model ?? 'opend-redteam',
      choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
      opend_redteam: { toolEvents },
    });
  } catch (error) {
    sendJson(response, 500, { error: { message: error instanceof Error ? error.message : String(error) } });
  }
});

server.listen(3210, '127.0.0.1', () => {
  console.log('opend Promptfoo red-team harness listening on http://127.0.0.1:3210/v1/chat/completions');
});
