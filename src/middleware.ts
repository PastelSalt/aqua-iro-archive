/** Admin guard + no-store for /keeper (EXECUTIONPLAN §15.2). Prerendered pages pass straight through. */
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  const p = ctx.url.pathname;
  const isKeeperPage = p.startsWith('/keeper');
  const open = p.startsWith('/keeper/login') || p.startsWith('/keeper/two-factor');
  const needsAdmin =
    (isKeeperPage && !open) || p.startsWith('/api/admin') || p.startsWith('/_actions/keeper.');
  const needsSession = p.startsWith('/keeper/two-factor/setup');
  if (needsAdmin || needsSession) {
    const { auth } = await import('./server/auth');
    const s = await auth().api.getSession({ headers: ctx.request.headers });
    if (!s)
      return isKeeperPage ? ctx.redirect('/keeper/login') : new Response('Unauthorized', { status: 401 });
    const user = s.user as { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };
    if (needsAdmin && !user.twoFactorEnabled)
      return isKeeperPage
        ? ctx.redirect('/keeper/two-factor/setup')
        : new Response('2FA required', { status: 403 });
    ctx.locals.admin = user;
  }
  const res = await next();
  if (isKeeperPage || p.startsWith('/api/admin')) {
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
});
