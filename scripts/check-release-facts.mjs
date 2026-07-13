import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf-8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf-8');
const rcExample = fs.readFileSync(new URL('../.opendrc.example.json', import.meta.url), 'utf-8');
const failures = [];
if (!readme.includes('Node 22 or 24')) failures.push('README must state Node 22 or 24');
if (!pkg.engines?.node?.includes('22')) failures.push('package engines must cover Node 22');
if (/\.veniceagentrc/.test(envExample) || /Copy this file to ~\/\.veniceagentrc/.test(rcExample)) failures.push('legacy config filename appears as primary instruction');
if (/any OpenAI-compatible endpoint works cleanly/i.test(readme)) failures.push('README contains an unverified universal provider claim');
if (/one bad guess can('|’)t wipe/i.test(readme)) failures.push('README contains an absolute blocklist safety claim');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Release facts passed for opend-ai ${pkg.version}`);
