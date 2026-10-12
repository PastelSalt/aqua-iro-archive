import { fileURLToPath } from 'node:url';
import { defineConfig, envField, fontProviders } from 'astro/config';
import vercel from '@astrojs/vercel';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

const SITE = process.env.SITE_URL ?? 'https://aqua-iro-archive.vercel.app';

export default defineConfig({
  site: SITE,
  output: 'static', // everything prerendered unless a route sets prerender = false
  adapter: vercel({
    // Vercel image optimizer stays OFF (Hobby: 5K transforms/mo). Astro + sharp handle images at build.
    maxDuration: 30,
  }),
  integrations: [
    preact(),
    sitemap({ filter: (page) => !page.includes('/keeper') && !page.includes('/api/') }),
  ],
  trailingSlash: 'never',
  compressHTML: true, // Astro 7 default is 'jsx'; true keeps inline whitespace predictable for JP/EN mixed text
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  security: { checkOrigin: true }, // CSRF protection for on-demand POSTs (Actions, admin)
  image: { responsiveStyles: true },
  // Fredoka is inlined + preloaded by <Font>. The Japanese families ship ~120 unicode-range slices per weight,
  // so their @font-face CSS is served once from /fonts/jp.css (cached, loaded without blocking render) instead of
  // being inlined into every page. Weights are trimmed to what the design uses.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Fredoka',
      cssVariable: '--font-fredoka',
      weights: [400, 500, 600, 700],
    },
    {
      provider: fontProviders.google(),
      name: 'Zen Maru Gothic',
      cssVariable: '--font-maru',
      weights: [500, 700],
      subsets: ['latin', 'japanese'],
    },
    {
      provider: fontProviders.google(),
      name: 'Shippori Mincho',
      cssVariable: '--font-mincho',
      weights: [700],
      subsets: ['latin', 'japanese'],
    },
  ],
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      DATABASE_URL_UNPOOLED: envField.string({ context: 'server', access: 'secret', optional: true }),
      IP_HASH_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      BETTER_AUTH_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      UMAMI_API_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      UMAMI_API_USER: envField.string({ context: 'server', access: 'secret', optional: true }),
      UMAMI_API_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_UMAMI_WEBSITE_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_UMAMI_SRC: envField.string({ context: 'client', access: 'public', default: '/s/ui.js' }),
      PUBLIC_UMAMI_HOST: envField.string({ context: 'client', access: 'public', default: '/s' }),
      PUBLIC_UMAMI_DOMAINS: envField.string({
        context: 'client',
        access: 'public',
        default: 'aqua-iro-archive.vercel.app',
      }),
      DISCORD_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    build: { cssMinify: 'lightningcss' },
    // see src/stubs/empty.js — keeps the build-only bundler out of the serverless function
    resolve: { alias: { rolldown: fileURLToPath(new URL('./src/stubs/empty.js', import.meta.url)) } },
  },
});
