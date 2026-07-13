import fs from 'node:fs';
import { VeniceAgent } from '../dist/agent.js';
import { createToolPolicy } from '../dist/tools.js';

const profileArg = process.argv.indexOf('--profile');
const profile = profileArg >= 0 ? process.argv[profileArg + 1] : '';
if (!['venice', 'ollama'].includes(profile)) {
  console.error('Specify --profile venice or --profile ollama.');
  process.exit(2);
}
const baseURL = process.env.VENICE_BASE_URL || (profile === 'venice' ? 'https://api.venice.ai/api/v1' : 'http://127.0.0.1:11434/v1');
const model = process.env.VENICE_MODEL;
const apiKey = process.env.VENICE_API_KEY || (profile === 'ollama' ? 'opend-local-no-key' : '');
const configuredTimeout = Number(process.env.OPEND_LIVE_EVAL_TIMEOUT_MS || 120_000);
const caseTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 120_000;
if (!model || (profile === 'venice' && !apiKey)) {
  console.error('Set VENICE_MODEL and the normal profile environment variables. Never put credentials in result files.');
  process.exit(2);
}
const cases = JSON.parse(fs.readFileSync(new URL('../evals/live-cases.json', import.meta.url)));
const results = [];
let baseOrigin = baseURL;
try { baseOrigin = new URL(baseURL).origin; } catch { /* retain the invalid value for diagnostics */ }
for (const item of cases) {
  try {
    let output = '';
    const agent = new VeniceAgent({
      apiKey,
      baseUrl: baseURL,
      model,
      maxRetries: 1,
      toolPolicy: createToolPolicy({ workspaceRoot: process.cwd() }),
      onContent: (text) => { output += text; },
      onToolEnd: (name, result) => { output += `\n${name}: ${result}`; },
      onConfirm: async () => false
    });
    let timer;
    await Promise.race([
      agent.chat(item.prompt),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Live evaluation case timed out after ${caseTimeoutMs}ms`)), caseTimeoutMs); })
    ]).finally(() => clearTimeout(timer));
    results.push({ id: item.id, status: output.toLowerCase().includes(item.grade.contains.toLowerCase()) ? 'passed' : 'failed', evidence: output.slice(0, 500) });
  } catch (error) {
    results.push({ id: item.id, status: 'failed', evidence: String(error.message || error) });
  }
}
const report = { profile, baseURL: baseOrigin, model, generatedAt: new Date().toISOString(), results };
const output = new URL(`../evals/results/live-${profile}.json`, import.meta.url);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`${results.filter((item) => item.status === 'passed').length}/${results.length} live cases passed; wrote ${output.pathname}`);
process.exit(results.every((item) => item.status === 'passed') ? 0 : 1);
