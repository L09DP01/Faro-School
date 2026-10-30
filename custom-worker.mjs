import handler from './.open-next/worker.js';

// Keep OpenNext's request context, bindings and asset handler intact.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
export default {
  fetch: handler.fetch,
  async scheduled(_controller, env, ctx) {
    const secret = env.CRON_SECRET?.trim();
    if (!secret) throw new Error('email_cron_secret_missing');
    // Internal dispatch: no public network round trip and no secret in the URL.
    // Authentication and SKIP LOCKED claiming remain in the existing route/RPC.
    const response = await handler.fetch(new Request('https://faroschool.com/api/cron/email-outbox', {
      headers: { Authorization: 'Bearer ' + secret },
    }), env, ctx);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('email_cron_failed_' + response.status);
    }
    await response.body?.cancel();
  },
};
