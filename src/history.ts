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

// Sliding-window split. Same boundary/budget logic as pruneHistory, but returns
// BOTH the kept window and the evicted older rounds, so callers can do something
// with the evicted content (e.g. summarize it) rather than silently dropping it.
// Never cuts mid-round, so a `tool` message is never orphaned from its tool_calls.
// Always keeps at least the current (newest) round, even if it alone exceeds budget.
// Returns new arrays; does not mutate the input.
export function splitForPrune(
  messages: any[],
  budget: number
): { kept: any[]; evicted: any[] } {
  if (messages.length <= 1) return { kept: messages, evicted: [] };
  const system = messages[0];
  const rest = messages.slice(1);

  const boundaries: number[] = [];
  rest.forEach((m, i) => {
    if (m.role === 'user') boundaries.push(i);
  });
  if (boundaries.length <= 1) return { kept: messages, evicted: [] }; // only the current round

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

  if (keepFrom === 0) return { kept: messages, evicted: [] };
  return { kept: [system, ...rest.slice(keepFrom)], evicted: rest.slice(0, keepFrom) };
}

// Sliding-window trim: the kept half of splitForPrune. Kept as a thin wrapper so
// existing callers/tests that only want the trimmed window are unaffected.
export function pruneHistory(messages: any[], budget: number): any[] {
  return splitForPrune(messages, budget).kept;
}
