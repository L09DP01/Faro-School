import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

async function main() {
  await mkdir('tmp/auth-middleware', { recursive: true });
  await build({ entryPoints: ['src/middleware.ts'], outfile: 'tmp/auth-middleware/session.cjs', bundle: true, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'intl-only', setup(b) {
    // Isolate locale rewriting; JWT encryption/decryption and middleware are real.
    b.onResolve({ filter: /^next-intl\/middleware$/ }, () => ({ path: 'intl', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'import {NextResponse} from "next/server";export default ()=>()=>NextResponse.next();', loader: 'js', resolveDir: process.cwd() }));
  } }] });
  const require = createRequire(resolve('package.json'));
  const file = resolve('tmp/auth-middleware/session.cjs');
  const env = process.env as Record<string, string | undefined>;
  const original = { NODE_ENV: env.NODE_ENV, AUTH_SECRET: env.AUTH_SECRET };
  const secret = 'offline-middleware-secret-at-least-32-characters'; env.AUTH_SECRET = secret;
  try {
    for (const mode of ['production', 'development']) {
      env.NODE_ENV = mode; delete require.cache[file];
      const { middleware } = require(file);
      const secure = mode === 'production';
      const name = (secure ? '__Secure-' : '') + 'authjs.session-token';
      const base = secure ? 'https://example.test' : 'http://localhost:3000';
      const makeCookie = async (role = 'student', maxAge = 3600) => name + '=' + await encode({ secret, salt: name, token: { id: '11111111-1111-4111-8111-111111111111', role, emailVerified: '2026-10-30' }, maxAge });
      const cookie = await makeCookie();
      for (const locale of ['fr', 'ht']) {
        const request = (path: string, value?: string) => new NextRequest(base + '/' + locale + path, { headers: value ? { cookie: value } : {} });
        assert.equal((await middleware(request('/dashboard', cookie))).headers.get('location'), null, mode + ': verified session must reach dashboard');
        const absent = await middleware(request('/dashboard')); assert.equal(new URL(absent.headers.get('location')).pathname, '/' + locale + '/connexion');
        const studentAdmin = await middleware(request('/admin', cookie)); assert.equal(new URL(studentAdmin.headers.get('location')).pathname, '/' + locale + '/dashboard');
        assert.equal((await middleware(request('/admin', await makeCookie('admin')))).headers.get('location'), null);
        const expired = await middleware(request('/dashboard', await makeCookie('student', -120))); assert(expired.headers.get('location'));
        const tampered = cookie.slice(0, cookie.indexOf('=') + 1) + 'forged-role-admin'; assert((await middleware(request('/dashboard', tampered))).headers.get('location'));
        // Auth.js splits large session cookies; decoding must retain that support.
        const value = cookie.slice(cookie.indexOf('=') + 1), split = Math.floor(value.length / 2);
        assert.equal((await middleware(request('/dashboard', name + '.0=' + value.slice(0, split) + '; ' + name + '.1=' + value.slice(split)))).headers.get('location'), null);
      }
    }
  } finally {
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete env[key]; else env[key] = value; }
  }
  console.log('PASS real Auth.js encrypted session cookies: production/development, FR/KR, chunks, expired/forged sessions and coarse role guards; no remote I/O');
}
main().catch(error => { console.error('FAIL middleware session regression', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
