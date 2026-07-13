export type ProviderKind = 'venice' | 'ollama' | 'openai-compatible';

export interface ProviderProfile {
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  local: boolean;
  requiresApiKey: boolean;
  sendVeniceParameters: boolean;
  includeStreamUsage: boolean;
  tested: boolean;
  contextTokens: number;
}

function parsedUrl(raw: string): URL {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('only http and https are supported');
    }
    return url;
  } catch (error: any) {
    throw new Error(`Invalid provider base URL ${JSON.stringify(raw)}: ${error.message}`);
  }
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function resolveProviderProfile(
  baseUrl: string,
  model: string,
  contextOverride?: number
): ProviderProfile {
  const url = parsedUrl(baseUrl);
  const host = url.hostname.toLowerCase();
  const venice = host === 'venice.ai' || host.endsWith('.venice.ai');
  const local = isLocalHost(host);
  const ollama = local && (url.port === '11434' || /ollama/i.test(model));

  if (venice) {
    return {
      kind: 'venice',
      label: 'Venice',
      baseUrl: url.toString().replace(/\/$/, ''),
      model,
      local: false,
      requiresApiKey: true,
      sendVeniceParameters: true,
      includeStreamUsage: true,
      tested: false,
      contextTokens: contextOverride ?? 96000
    };
  }

  if (ollama) {
    return {
      kind: 'ollama',
      label: 'Ollama (local)',
      baseUrl: url.toString().replace(/\/$/, ''),
      model,
      local: true,
      requiresApiKey: false,
      sendVeniceParameters: false,
      includeStreamUsage: false,
      tested: false,
      contextTokens: contextOverride ?? 32768
    };
  }

  return {
    kind: 'openai-compatible',
    label: local ? 'Local OpenAI-compatible endpoint' : 'OpenAI-compatible endpoint',
    baseUrl: url.toString().replace(/\/$/, ''),
    model,
    local,
    requiresApiKey: !local,
    sendVeniceParameters: false,
    includeStreamUsage: false,
    tested: false,
    contextTokens: contextOverride ?? 32768
  };
}

export function providerDisclosure(profile: ProviderProfile): string {
  if (profile.local) return `${profile.label} · local endpoint · unverified profile`;
  return `${profile.label} · remote provider receives prompts/tool results · unverified live profile`;
}
