import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('dist');
await mkdir(out, { recursive: true });
await cp('src', resolve(out, 'src'), { recursive: true, force: true });
await cp('index.html', resolve(out, 'index.html'), { force: true });
await mkdir(resolve(out, 'tests'), { recursive: true });
await cp('tests/browser-acceptance.js', resolve(out, 'tests/browser-acceptance.js'), { force: true });
const html = await readFile(resolve(out, 'index.html'), 'utf8');
for (const required of ['./src/web/main.js', './src/web/styles.css']) {
  if (!html.includes(required)) throw new Error('Bundle lacks entry: ' + required);
}
await writeFile(resolve(out, 'build-info.json'), JSON.stringify({
  name: 'arcanomata',
  target: 'web-static',
  generatedAt: new Date().toISOString()
}, null, 2));
process.stdout.write('Web static bundle created: dist/\n');
