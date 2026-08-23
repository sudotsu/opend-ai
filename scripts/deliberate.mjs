#!/usr/bin/env node
try {
  const { main } = await import('../dist/deliberate-cli.js');
  process.exitCode = await main();
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Deliberate mode is not built. Run npm run build first.');
    process.exitCode = 2;
  } else {
    throw error;
  }
}
