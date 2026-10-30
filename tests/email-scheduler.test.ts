import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

async function main() {
  const requests: Request[] = [];
  let status = 200;
  (globalThis as any).__scheduledFetch = async (request: Request, env: unknown, ctx: unknown) => {
    assert.equal(env, bindings); assert.equal(ctx, context); requests.push(request);
    return new Response('private response must not be logged', { status });
  };
  const bindings = { CRON_SECRET: 'offline-test-secret' }, context = {};
  await mkdir('tmp/email-scheduler', { recursive: true });
  await build({ entryPoints: ['custom-worker.mjs'], outfile: 'tmp/email-scheduler/worker.cjs', bundle: true, platform: 'node', format: 'cjs', plugins: [{ name: 'offline', setup(b) {
    b.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({ path: 'worker', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default {fetch:(...args)=>globalThis.__scheduledFetch(...args)}; export class DOQueueHandler{};export class DOShardedTagCache{};export class BucketCachePurge{};', loader: 'js' }));
  } }] });
  const worker = createRequire(resolve('package.json'))(resolve('tmp/email-scheduler/worker.cjs')).default;
  await worker.scheduled({}, bindings, context);
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).pathname, '/api/cron/email-outbox');
  assert.equal(new URL(requests[0].url).search, '');
  assert.equal(requests[0].headers.get('authorization'), 'Bearer ' + bindings.CRON_SECRET);
  const normal = new Request('https://example.test/fr');
  await worker.fetch(normal, bindings, context); assert.equal(requests.at(-1), normal);
  status = 503; await assert.rejects(() => worker.scheduled({}, bindings, context), /email_cron_failed_503/);
  const before = requests.length;
  await assert.rejects(() => worker.scheduled({}, {}, context), /email_cron_secret_missing/);
  assert.equal(requests.length, before);
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  assert.equal(config.main, 'custom-worker.mjs');
  assert.deepEqual(config.triggers.crons, ['* * * * *']); assert.equal(config.keep_vars, true);
  console.log('PASS scheduled email dispatch, route authentication, fetch passthrough and fail-closed errors; no remote I/O');
}
main().catch(() => { console.error('FAIL email scheduler'); process.exitCode = 1; });
