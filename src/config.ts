import fs from 'fs';
import { resolvePath } from './tools.js';
import type { Posture } from './prompts.js';

// USD per 1,000,000 tokens. Default 0/0 = unknown → the CLI shows token counts
// but not a dollar cost until the user sets real pricing for their model.
export interface Pricing {
  in: number;
  out: number;
}

// Venice-only request extension (only sent when the base URL is Venice).
// disableThinking:false + stripThinkingResponse:false is what makes the model's
// reasoning stream back to the client at all — see agent.ts. These default to
// the values the CLI was built around; exposed here so the behavior is legible
// and tunable rather than buried in the request builder.
export interface VeniceParams {
  disableThinking: boolean;         // false → model produces reasoning
  stripThinkingResponse: boolean;   // false → reasoning is not stripped from the response
  includeVeniceSystemPrompt: boolean; // false → use our own system prompt, not Venice's
}

export interface AppConfig {
  apiKey: string;
  baseUrl: string;         // OpenAI-compatible API base; Venice by default
  model: string;
  posture: Posture;
  contextTokens: number;   // sliding-window budget (estimated tokens)
  maxRetries: number;      // API retry attempts on transient failure
  pricing: Pricing;
  bypassDefault: boolean;  // start in bypass permission mode
  showUsagePerTurn: boolean;
  showThinking: boolean;   // render the reasoning panel client-side (model still reasons either way)
  extraDenylist: string[]; // extra catastrophic-command regex sources (strings)
  temperature?: number;    // undefined → omit from request, use provider default
  maxIterations: number;   // max tool-call rounds per turn before bailing out
  commandTimeoutMs: number; // run_command hard timeout
  summarizeOnPrune: boolean; // condense evicted rounds into a rolling summary vs. dropping them
  maxSummaryTokens: number;  // max_tokens for the summarizer call (bounds summary growth)
  veniceParams: VeniceParams;
}

const DEFAULTS: Omit<AppConfig, 'apiKey' | 'temperature'> = {
  baseUrl: 'https://api.venice.ai/api/v1',
  model: 'olafangensan-glm-4.7-flash-heretic',
  posture: 'coding',
  contextTokens: 96000,
  maxRetries: 3,
  pricing: { in: 0, out: 0 },
  bypassDefault: false,
  showUsagePerTurn: false,
  showThinking: true,
  extraDenylist: [],
  maxIterations: 50,
  commandTimeoutMs: 30000,
  summarizeOnPrune: true,
  maxSummaryTokens: 1024,
  veniceParams: {
    disableThinking: false,
    stripThinkingResponse: false,
    includeVeniceSystemPrompt: false
  }
};

function readJsonIfExists(p: string): Record<string, any> {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (err: any) {
    // Malformed config should warn, not crash the whole CLI.
    console.error(`Warning: could not parse config at ${p}: ${err.message}`);
  }
  return {};
}

// Pure merge: DEFAULTS < homeCfg < cwdCfg < env. Exported (no fs) so precedence is
// unit-testable without touching the real filesystem or $HOME.
export function mergeConfig(
  homeCfg: Record<string, any>,
  cwdCfg: Record<string, any>,
  env: NodeJS.ProcessEnv
): AppConfig {
  const fileCfg = { ...homeCfg, ...cwdCfg };

  const merged: AppConfig = {
    ...DEFAULTS,
    ...fileCfg,
    pricing: { ...DEFAULTS.pricing, ...(fileCfg.pricing || {}) },
    veniceParams: { ...DEFAULTS.veniceParams, ...(fileCfg.veniceParams || {}) },
    apiKey: env.VENICE_API_KEY || fileCfg.apiKey || '',
    baseUrl: env.VENICE_BASE_URL || fileCfg.baseUrl || DEFAULTS.baseUrl,
    model: env.VENICE_MODEL || fileCfg.model || DEFAULTS.model
  } as AppConfig;

  const envPosture = env.VENICE_POSTURE as Posture | undefined;
  if (envPosture === 'coding' || envPosture === 'raw') merged.posture = envPosture;

  // Temperature is optional: undefined must stay undefined so the request omits it
  // and the provider's own default applies. Never coerce to 0.
  const envTemp = env.VENICE_TEMPERATURE !== undefined ? Number(env.VENICE_TEMPERATURE) : undefined;
  if (envTemp !== undefined && !Number.isNaN(envTemp)) merged.temperature = envTemp;

  return merged;
}

/**
 * Precedence (lowest → highest): DEFAULTS < ~/.veniceagentrc.json <
 * ./.veniceagentrc.json < environment variables. The project-local file overrides
 * the user-global one; env always wins so existing .env workflows keep working.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const homeCfg = readJsonIfExists(resolvePath('~/.veniceagentrc.json'));
  const cwdCfg = readJsonIfExists(resolvePath('.veniceagentrc.json'));
  return mergeConfig(homeCfg, cwdCfg, env);
}
