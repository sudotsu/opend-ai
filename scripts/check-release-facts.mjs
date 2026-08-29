import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf-8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf-8');
const rcExample = fs.readFileSync(new URL('../.opendrc.example.json', import.meta.url), 'utf-8');
const publishWorkflow = fs.readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf-8');
const failures = [];
if (!readme.includes('Node 22 or 24')) failures.push('README must state Node 22 or 24');
if (!pkg.engines?.node?.includes('22')) failures.push('package engines must cover Node 22');
if (pkg.publishConfig?.access !== 'public') failures.push('package publishConfig.access must be public');
if (pkg.name !== '@sudotsu/opend-ai') failures.push('npm package name must be @sudotsu/opend-ai');
if (pkg.bin?.['opend-ai'] !== 'dist/index.js') failures.push('package must expose an opend-ai bin for npx');
if (!readme.includes('npm install -g @sudotsu/opend-ai')) failures.push('README must include the global npm install command');
if (!readme.includes('npx @sudotsu/opend-ai')) failures.push('README must include the npx command');
if (/once published to npm/i.test(readme)) failures.push('README still describes npm publishing as pending');
if (!publishWorkflow.includes('id-token: write')) failures.push('npm publish workflow must enable OIDC');
if (!publishWorkflow.includes('environment: npm')) failures.push('npm publish workflow must use the npm environment');
if (/\.veniceagentrc/.test(envExample) || /Copy this file to ~\/\.veniceagentrc/.test(rcExample)) failures.push('legacy config filename appears as primary instruction');
if (/any OpenAI-compatible endpoint works cleanly/i.test(readme)) failures.push('README contains an unverified universal provider claim');
if (/one bad guess can('|’)t wipe/i.test(readme)) failures.push('README contains an absolute blocklist safety claim');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Release facts passed for ${pkg.name} ${pkg.version}`);
