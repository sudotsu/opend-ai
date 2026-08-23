#!/usr/bin/env node
let main;
try {
  // Only the build-time import is guarded here. Wrapping the call to main()
  // would let a genuine runtime dependency failure be misreported as "not built".
  ({ main } = await import('../dist/deliberate-cli.js'));
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Deliberate mode is not built. Run npm run build first.');
    process.exitCode = 2;
  } else {
    throw error;
  }
}

if (main) process.exitCode = await main();
