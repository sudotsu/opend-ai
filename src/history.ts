// Pure conversation-history helpers. Kept separate from the agent so they can be
// unit-tested directly. The sliding-window logic here is load-bearing: get it
// wrong and you either overflow the model's context or 400 the API by orphaning a
// `tool` message from the assistant `tool_calls` it answers.

// Rough token estimate (~4 chars/token) plus a small per-message overhead.
export function estTokens(msg: any): number {
  let chars = 0;
  if (typeof msg?.content === 'string') chars += msg.content.length;
  if (msg?.tool_calls) chars += JSON.stringify(msg.tool_calls).length;
  if (msg?.name) chars += String(msg.name).length;
  return Math.ceil(chars / 4) + 4;
}

// Sliding-window trim. Keeps the system message and as many whole recent "rounds"
// (a user message plus its assistant/tool follow-ups) as fit in the token budget.
// Never cuts mid-round, so a `tool` message is never orphaned from its tool_calls.
// Always keeps at least the current (newest) round, even if it alone exceeds budget.
// Returns a new array; does not mutate the input.
export function pruneHistory(messages: any[], budget: number): any[] {
  if (messages.length <= 1) return messages;
  const system = messages[0];
  const rest = messages.slice(1);

  const boundaries: number[] = [];
  rest.forEach((m, i) => {
    if (m.role === 'user') boundaries.push(i);
  });
  if (boundaries.length <= 1) return messages; // only the current round — nothing safe to trim

  const currentRoundStart = boundaries[boundaries.length - 1];
  let acc = estTokens(system);
  for (let i = currentRoundStart; i < rest.length; i++) acc += estTokens(rest[i]);

  let keepFrom = currentRoundStart;
  for (let b = boundaries.length - 2; b >= 0; b--) {
    let roundTok = 0;
    for (let i = boundaries[b]; i < boundaries[b + 1]; i++) roundTok += estTokens(rest[i]);
    if (acc + roundTok > budget) break;
    acc += roundTok;
    keepFrom = boundaries[b];
  }

  return keepFrom > 0 ? [system, ...rest.slice(keepFrom)] : messages;
}
