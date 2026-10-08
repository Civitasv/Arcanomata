import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bin = process.env.CHROME_BIN || 'google-chrome';
const host = '127.0.0.1', port = 4789;
const server = spawn(process.execPath, ['scripts/serve.mjs', '--dist'], {
  env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
});
let serverError = '';
server.stderr.on('data', x => { serverError += x.toString(); });
const folder = await mkdtemp(join(tmpdir(), 'arcanomata-browser-'));
await mkdir('artifacts', { recursive: true });
function launch(args, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('Browser timed out')); }, timeout);
    p.stdout.on('data', data => { stdout += data.toString(); });
    p.stderr.on('data', data => { stderr += data.toString(); });
    p.on('error', err => { clearTimeout(timer); reject(err); });
    p.on('close', code => {
      clearTimeout(timer);
      code === 0 ? resolve({ stdout, stderr }) :
        reject(new Error('Browser exit ' + code + ': ' + stderr.slice(-1200)));
    });
  });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch('http://' + host + ':' + port + '/')).ok) { ready = true; break; } }
    catch { /* retry until the server listens */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Local server did not start: ' + serverError);
  for (const [name, size] of [['desktop', '1366,850'], ['mobile', '390,844']]) {
    const url = 'http://' + host + ':' + port + '/?smoke=1&seed=12345';
    const common = [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--hide-scrollbars', '--no-first-run',
      '--disable-features=MediaRouter', '--virtual-time-budget=5000',
      '--window-size=' + size, '--user-data-dir=' + join(folder, name)
    ];
    const result = await launch([...common, '--dump-dom', url]);
    if (!result.stdout.includes('data-smoke="PASS"')) {
      throw new Error(name + ' acceptance failed; DOM tail: ' + result.stdout.slice(-2400));
    }
    const image = join('artifacts', 'smoke-' + name + '.png');
    await launch([...common.slice(0, -1), '--user-data-dir=' + join(folder, name + '-screenshot'),
      '--screenshot=' + image, url]);
    process.stdout.write(name + ' browser acceptance PASS; screenshot: ' + image + '\n');
  }
} finally {
  server.kill('SIGTERM');
  await rm(folder, { recursive: true, force: true });
}
