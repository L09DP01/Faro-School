import handler from './.open-next/worker.js';

// Keep OpenNext's request context, bindings and asset handler intact.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Secure Auth.js cookies cannot be stored or sent from an HTTP page.
    // Upgrade before OpenNext serves HTML or any auth endpoint; local dev stays HTTP.
    if (url.protocol === 'http:' && ['faroschool.com', 'www.faroschool.com'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    return handler.fetch(request, env, ctx);
  },
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
