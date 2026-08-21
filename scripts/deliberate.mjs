#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
dotenv.config({ path: path.join(os.homedir(), '.opend', '.env') });

const prompt = process.argv.slice(2).join(' ').trim();
if (!prompt) {
  console.error('Usage: node scripts/deliberate.mjs "your question"');
  process.exit(2);
}

let rc = {};
for (const p of [path.join(os.homedir(), '.opendrc.json'), path.join(process.cwd(), '.opendrc.json')]) {
  try { if (fs.existsSync(p)) rc = { ...rc, ...JSON.parse(fs.readFileSync(p, 'utf8')) }; } catch {}
}

const baseURL = process.env.VENICE_BASE_URL || rc.baseUrl || 'https://api.venice.ai/api/v1';
const model = process.env.VENICE_MODEL || rc.model || 'olafangensan-glm-4.7-flash-heretic';
const apiKey = process.env.VENICE_API_KEY || rc.apiKey || 'opend-local-no-key';
const client = new OpenAI({ apiKey, baseURL });
const isVenice = (() => { try { return new URL(baseURL).hostname === 'api.venice.ai'; } catch { return false; } })();

const common = `You are one member of an independent reasoning panel. Answer the user's actual question directly. Do not defer to other panel members. Separate facts from inference, identify uncertainty, and optimize for correctness rather than agreement. Do not add generic moralizing or filler.`;
const roles = [
  'Solve the problem from first principles. Build the strongest answer you can and expose assumptions.',
  'Approach independently as a skeptical domain expert. Look for details, edge cases, and mechanisms the obvious answer misses.',
  'Approach independently as a verification-focused researcher. Challenge likely misconceptions and distinguish known facts from plausible inference.'
];

function providerExtras(disableThinking = false) {
  return isVenice ? { venice_parameters: { disable_thinking: disableThinking, strip_thinking_response: true, include_venice_system_prompt: false } } : {};
}

async function complete(messages, temperature = 0.35) {
  const r = await client.chat.completions.create({
    model,
    messages,
    temperature,
    stream: false,
    ...providerExtras(false)
  });
  return r.choices?.[0]?.message?.content?.trim() || '';
}

console.error(`[deliberate] ${model}: running 3 independent analyses...`);
const analyses = await Promise.all(roles.map((role) => complete([
  { role: 'system', content: `${common}\n\nYour role: ${role}` },
  { role: 'user', content: prompt }
])));

console.error('[deliberate] running adversarial critic...');
const packet = analyses.map((a, i) => `ANALYSIS ${i + 1}:\n${a}`).join('\n\n---\n\n');
const critique = await complete([
  { role: 'system', content: `${common}\n\nYou are the adversarial critic. Inspect the candidate analyses for factual errors, unsupported claims, contradictions, missing considerations, and false consensus. Do not merely summarize them.` },
  { role: 'user', content: `ORIGINAL QUESTION:\n${prompt}\n\nCANDIDATE ANALYSES:\n${packet}` }
], 0.2);

console.error('[deliberate] synthesizing final answer...');
const final = await complete([
  { role: 'system', content: `${common}\n\nYou are the final editor. Produce the best answer to the original question using the independent analyses and critic as fallible research notes. Resolve disagreements yourself. Do not mention the panel, candidates, or this process. Never preserve a claim merely because multiple candidates repeated it.` },
  { role: 'user', content: `ORIGINAL QUESTION:\n${prompt}\n\nRESEARCH NOTES:\n${packet}\n\nADVERSARIAL CRITIQUE:\n${critique}` }
], 0.2);

process.stdout.write(final + '\n');
