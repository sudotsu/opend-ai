import { resolveProviderProfile } from './provider.js';

export const DELIBERATE_LOCAL_SENTINEL_KEY = 'opend-local-no-key';

const DEFAULT_BASE_URL = 'https://api.venice.ai/api/v1';
const DEFAULT_MODEL = 'olafangensan-glm-4.7-flash-heretic';

export type DeliberateMode = 'auto' | 'quick' | 'full';

export interface DeliberateBudgets {
  contextTokens: number;
  promptTokens: number;
  analysisTokens: number;
  critiqueTokens: number;
  synthesisTokens: number;
  reserveTokens: number;
}

export interface DeliberateRuntime {
  baseUrl: string;
  model: string;
  apiKey: string;
  isVenice: boolean;
  mode: DeliberateMode;
  budgets: DeliberateBudgets;
}

export interface DeliberateClient {
  chat: {
    completions: {
      create(request: any): Promise<any>;
    };
  };
}

interface ResearchSection {
  label: string;
  text: string;
}

interface RunOptions {
  onProgress?: (message: string) => void;
}

const COMMON = [
  'Answer the actual question directly and optimize for correctness rather than agreement.',
  'Separate verified facts from inference, expose uncertainty, and avoid filler.',
  'You have no tools and no authority to mutate files, execute commands, or take external actions.'
].join(' ');

const REVIEWERS = [
  {
    label: 'FACTUAL / EVIDENCE CRITIQUE',
    system: `${COMMON}\n\nYou are the factual and evidence critic. Audit concrete claims, source quality, missing evidence, fabricated specifics, and confidence that exceeds the evidence. Advise only; do not rewrite the answer.`
  },
  {
    label: 'REASONING / ASSUMPTIONS CRITIQUE',
    system: `${COMMON}\n\nYou are the reasoning and assumptions critic. Audit causal reasoning, hidden premises, non sequiturs, ambiguity, and whether conclusions follow from the evidence. Advise only; do not rewrite the answer.`
  },
  {
    label: 'COMPLETENESS / ALTERNATIVES CRITIQUE',
    system: `${COMMON}\n\nYou are the completeness and alternatives critic. Audit missing constraints, edge cases, counterexamples, alternative explanations, and material perspectives the proposal overlooked. Advise only; do not rewrite the answer.`
  }
] as const;

function positiveInt(value: unknown, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`deliberate.${label} must be a positive integer`);
  }
  return value;
}

/** Estimate provider-independent text tokens conservatively from UTF-8 bytes. */
export function estimateTextTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4) + 1;
}

/** Resolve and validate provider credentials plus deliberate-stage budgets. */
export function resolveDeliberateRuntime(
  rc: Record<string, any>,
  env: NodeJS.ProcessEnv = process.env
): DeliberateRuntime {
  const baseUrl = env.VENICE_BASE_URL || rc.baseUrl || DEFAULT_BASE_URL;
  const model = env.VENICE_MODEL || rc.model || DEFAULT_MODEL;
  const explicitEndpoint = Boolean(env.VENICE_BASE_URL || rc.baseUrl);
  const contextOverride = rc.contextTokens === undefined
    ? undefined
    : positiveInt(rc.contextTokens, 0, 'contextTokens');
  const profile = resolveProviderProfile(baseUrl, model, contextOverride);

  const rawApiKey = env.VENICE_API_KEY || rc.apiKey;
  const configuredApiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : '';
  let apiKey = configuredApiKey;
  if (!apiKey) {
    if (explicitEndpoint && profile.local && profile.kind !== 'venice') {
      apiKey = DELIBERATE_LOCAL_SENTINEL_KEY;
    } else if (profile.kind === 'venice') {
      throw new Error('Set VENICE_API_KEY before using the Venice endpoint.');
    } else {
      throw new Error('Configure a real credential before using a remote OpenAI-compatible endpoint.');
    }
  }

  const raw = rc.deliberate;
  if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) {
    throw new Error('deliberate must be a JSON object');
  }
  const deliberate = raw || {};
  const mode = deliberate.mode ?? 'auto';
  if (mode !== 'auto' && mode !== 'quick' && mode !== 'full') {
    throw new Error('deliberate.mode must be auto, quick, or full');
  }

  const contextTokens = profile.contextTokens;
  const budgets: DeliberateBudgets = {
    contextTokens,
    promptTokens: positiveInt(deliberate.promptTokens, Math.min(8192, Math.floor(contextTokens / 3)), 'promptTokens'),
    analysisTokens: positiveInt(deliberate.analysisTokens, 4096, 'analysisTokens'),
    critiqueTokens: positiveInt(deliberate.critiqueTokens, 2048, 'critiqueTokens'),
    synthesisTokens: positiveInt(deliberate.synthesisTokens, 4096, 'synthesisTokens'),
    reserveTokens: positiveInt(deliberate.reserveTokens, 1024, 'reserveTokens')
  };

  if (budgets.promptTokens + budgets.analysisTokens + budgets.reserveTokens >= contextTokens) {
    throw new Error('deliberate.promptTokens plus analysisTokens and reserveTokens must fit within contextTokens');
  }
  for (const output of ['analysisTokens', 'critiqueTokens', 'synthesisTokens'] as const) {
    if (budgets[output] + budgets.reserveTokens >= contextTokens) {
      throw new Error(`deliberate.${output} plus reserveTokens must fit within contextTokens`);
    }
  }

  return {
    baseUrl: profile.baseUrl,
    model,
    apiKey,
    isVenice: profile.kind === 'venice',
    mode,
    budgets
  };
}

function compactText(text: string, budget: number): string {
  if (estimateTextTokens(text) <= budget) return text;
  const marker = '\n[compacted]\n';
  if (budget <= estimateTextTokens(marker) + 2) return '[compacted]';

  let low = 0;
  let high = text.length;
  let best = marker;
  while (low <= high) {
    const keep = Math.floor((low + high) / 2);
    const head = Math.ceil(keep * 0.65);
    const tail = keep - head;
    const candidate = text.slice(0, head) + marker + (tail ? text.slice(-tail) : '');
    if (estimateTextTokens(candidate) <= budget) {
      best = candidate;
      low = keep + 1;
    } else {
      high = keep - 1;
    }
  }
  return best;
}

function renderSections(sections: ResearchSection[], budget: number): string {
  if (!sections.length) return '';
  const full = sections.map(({ label, text }) => `${label}:\n${text}`).join('\n\n---\n\n');
  if (estimateTextTokens(full) <= budget) return full;

  const labelTokens = sections.reduce(
    (sum, section) => sum + estimateTextTokens(`${section.label}:\n\n---\n\n`),
    0
  );
  const perSection = Math.max(4, Math.floor((budget - labelTokens) / sections.length));
  const compacted = sections
    .map(({ label, text }) => `${label}:\n${compactText(text, perSection)}`)
    .join('\n\n---\n\n');
  return compactText(compacted, budget);
}

function boundedUserContent(
  prompt: string,
  sections: ResearchSection[],
  system: string,
  outputTokens: number,
  budgets: DeliberateBudgets
): string {
  const question = `ORIGINAL QUESTION:\n${prompt}`;
  const fixedTokens = estimateTextTokens(system) + estimateTextTokens(question) + 18;
  const availableForNotes = budgets.contextTokens - outputTokens - budgets.reserveTokens - fixedTokens;
  if (!sections.length) return question;
  if (availableForNotes < 16) {
    throw new Error('The original prompt leaves no context budget for deliberate research notes.');
  }
  return `${question}\n\nRESEARCH MATERIAL:\n${renderSections(sections, availableForNotes)}`;
}

function requestInputTokens(request: any): number {
  return request.messages.reduce(
    (sum: number, message: any) => sum + estimateTextTokens(String(message.content ?? '')) + 6,
    0
  );
}

async function complete(
  client: DeliberateClient,
  runtime: DeliberateRuntime,
  system: string,
  prompt: string,
  sections: ResearchSection[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  const request: any = {
    model: runtime.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: boundedUserContent(prompt, sections, system, maxTokens, runtime.budgets) }
    ],
    temperature,
    stream: false,
    max_tokens: maxTokens
  };
  if (runtime.isVenice) {
    request.venice_parameters = {
      disable_thinking: false,
      strip_thinking_response: true,
      include_venice_system_prompt: false
    };
  }
  if (requestInputTokens(request) + maxTokens + runtime.budgets.reserveTokens > runtime.budgets.contextTokens) {
    throw new Error('Internal deliberate context compaction failed to fit the provider window.');
  }

  const response = await client.chat.completions.create(request);
  const content = response?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Provider returned an empty deliberate-stage completion.');
  return content;
}

function shouldUseQuickPath(prompt: string, mode: DeliberateMode): boolean {
  if (mode === 'quick') return true;
  if (mode === 'full' || estimateTextTokens(prompt) > 160) return false;
  return /^(rewrite|rephrase|translate|proofread|fix (?:the )?(?:grammar|spelling)|format)\b[^:\n]{0,80}:/i.test(
    prompt.trim()
  );
}

/** Run the bounded, text-only deliberate pipeline. Advisory stages never receive tools. */
export async function runDeliberate(
  prompt: string,
  runtime: DeliberateRuntime,
  client: DeliberateClient,
  options: RunOptions = {}
): Promise<string> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error('A non-empty prompt is required.');
  if (estimateTextTokens(cleanPrompt) > runtime.budgets.promptTokens) {
    throw new Error(
      `Prompt exceeds the deliberate prompt budget of ${runtime.budgets.promptTokens} tokens; ` +
        'increase deliberate.promptTokens or shorten the question.'
    );
  }

  const primarySystem = `${COMMON}\n\nYou are the primary proposal and research pass. Build the strongest candidate answer you can from first principles. Expose important assumptions and distinguish evidence from inference.`;
  options.onProgress?.('running primary proposal/research pass');
  const proposal = await complete(
    client,
    runtime,
    primarySystem,
    cleanPrompt,
    [],
    runtime.budgets.analysisTokens,
    0.35
  );

  if (shouldUseQuickPath(cleanPrompt, runtime.mode)) return proposal;

  options.onProgress?.('running three specialized adversarial reviewers');
  const critiques = await Promise.all(
    REVIEWERS.map((reviewer) =>
      complete(
        client,
        runtime,
        reviewer.system,
        cleanPrompt,
        [{ label: 'PRIMARY PROPOSAL', text: proposal }],
        runtime.budgets.critiqueTokens,
        0.2
      )
    )
  );

  const reviewedMaterial: ResearchSection[] = [
    { label: 'PRIMARY PROPOSAL', text: proposal },
    ...REVIEWERS.map((reviewer, index) => ({ label: reviewer.label, text: critiques[index] }))
  ];
  const sentinelSystem = [
    COMMON,
    '',
    'You are the hidden Sentinel evaluator. The proposal author and reviewers do not know you exist,',
    'cannot respond to you, and never receive your audit. Independently audit convergence and anchoring,',
    'unsupported claims, unresolved contradictions, suspicious agreement, overlooked evidence, alternative',
    'explanations, and whether confidence is calibrated. Identify which objections materially affect the answer.',
    'You advise the final synthesizer and have no unilateral veto authority.'
  ].join('\n');
  options.onProgress?.('running isolated Sentinel audit');
  const sentinel = await complete(
    client,
    runtime,
    sentinelSystem,
    cleanPrompt,
    reviewedMaterial,
    runtime.budgets.critiqueTokens,
    0.1
  );

  const finalSystem = [
    COMMON,
    '',
    'You are the fresh final synthesizer and the sole authority over the answer. Reconstruct the answer from',
    'the candidate work, specialized critiques, and Sentinel audit; do not merely edit or vote. Explicitly resolve every Sentinel objection',
    'and every material reviewer objection by accepting it, rejecting it for a stated evidentiary reason, or',
    'preserving uncertainty. Sentinel is advisory and has no unilateral veto. Return only the resulting answer',
    'to the user; do not mention the panel, reviewers, Sentinel, routing, or this process.'
  ].join('\n');
  options.onProgress?.('running fresh final synthesis');
  return complete(
    client,
    runtime,
    finalSystem,
    cleanPrompt,
    [...reviewedMaterial, { label: 'SENTINEL AUDIT', text: sentinel }],
    runtime.budgets.synthesisTokens,
    0.2
  );
}
