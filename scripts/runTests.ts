import { Glob } from 'bun';

const args = process.argv.slice(2);
const coverageMode = args.includes('--coverage');
const watchMode = args.includes('--watch');

if (watchMode) {
    const proc = Bun.spawn(['bun', 'test', '--watch'], { stdio: ['inherit', 'inherit', 'inherit'] });
    await proc.exited;
    process.exit(proc.exitCode ?? 0);
}

const glob = new Glob('**/*.test.{ts,tsx}');
const testFiles: string[] = [];

for await (const file of glob.scan({ cwd: process.cwd(), absolute: false })) {
    if (!file.includes('node_modules')) {
        testFiles.push(file);
    }
}

testFiles.sort();

let passed = 0;
let failed = 0;
const failedFiles: string[] = [];

for (const file of testFiles) {
    const bunArgs = ['bun', 'test', file];
    if (coverageMode) bunArgs.push('--coverage');

    const proc = Bun.spawn(bunArgs, { stdio: ['inherit', 'inherit', 'inherit'] });
    const exitCode = await proc.exited;

    if (exitCode === 0) {
        passed++;
    } else {
        failed++;
        failedFiles.push(file);
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Test files: ${passed + failed} total, ${passed} passed, ${failed} failed`);
if (failedFiles.length > 0) {
    console.log('Failed files:');
    for (const f of failedFiles) console.log(`  - ${f}`);
}
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
