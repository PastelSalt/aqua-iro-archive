# Aqua Iro Archive · あくあ色アーカイブ

An unofficial, non-profit fan archive of Minato Aqua (2018–2024). Project 44.5 by Moesoft.
Design concept: `../PRELIMENARYPLAN.md` · build spec: `../EXECUTIONPLAN.md` · content snapshot: `../RAWDATA.md`.

Astro 7 (static first) + Preact islands, plain CSS, Neon Postgres + Drizzle, Better Auth (TOTP), Cloudflare Turnstile,
self-hosted Umami, Vercel Hobby.

## Commands

| Command                                          | What it does                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                    | Dev server on :4321                                                                                       |
| `npm run build`                                  | `data` → `astro check` → `astro build` → prune unused images → CSP hashes into `vercel.json`              |
| `npm run data`                                   | Rebuild `streams.json` from `data/raw/streams.full.tsv` (+ overrides) and validate the Talk scripts       |
| `npm run images`                                 | Re-curate `../assets` → `src/assets` from `src/content/arts/arts.yaml` (needs the original assets folder) |
| `npm test`                                       | Unit + data + integration tests (the board pipeline runs against PGlite with the real migrations)         |
| `npm run test:e2e`                               | Playwright + axe against the built site served with the `vercel.json` headers (CSP included)              |
| `npm run lint` / `npm run format`                | ESLint + Prettier                                                                                         |
| `npm run budget`                                 | Per-page JS budget check (§1.3)                                                                           |
| `npm run contrast`                               | WCAG AA check of the colour tokens                                                                        |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations (`db/migrations`) and seeds (`db/seed`)                                                |
| `npm run admin:create`                           | One-time keeper account (asks for the passphrase; sign-up is disabled in the app)                         |
| `tsx scripts/reset-2fa.ts`                       | Runbook §25.5 — reset the keeper's two-factor                                                             |
| `tsx scripts/make-og.ts`                         | Regenerate the 1200×630 share images in `public/og/`                                                      |

## Where things live

- Content (edit these): `src/content/**/*.yaml` — profile, lore, clips, songs, events, arts (with bilingual alt text),
  `talk/*.yaml` (Talk with Aqua scripts, see `src/content/talk/README.md`). Streams come from `data/raw/` + `data/overrides/`.
- Chrome: `src/components/chrome/` (Dock, LOG drawer, BGM capsule, splash, logo tab, footer).
- Pages: `src/pages/` (8 chapters + credits, privacy, 404, `/keeper/*`, `/api/*`).
- Server: `src/server/` (board pipeline, moderation, security, settings, alerts, Umami client, auth).

## Setting up the services (Phase 0, needs your accounts)

1. **GitHub**: private repo `aqua-iro-archive`, push this folder, branch rule on `main`.
2. **Vercel**: import the repo, framework Astro, Node 24.x, region `sin1`. Hobby = non-commercial only.
3. **Neon** (Vercel Marketplace integration, `ap-southeast-1`): sets `DATABASE_URL` / `DATABASE_URL_UNPOOLED`;
   enable branch-per-preview. Locally: point `.env` at a `dev` branch, then `npm run db:migrate && npm run db:seed`.
4. **Secrets** (see `.env.example`): `IP_HASH_SECRET` (64 hex), `CRON_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   Turnstile site/secret keys (local + CI use Cloudflare's testing keys already in `.env.example`), `DISCORD_WEBHOOK_URL`,
   `PUBLIC_CONTACT_EMAIL` (removal requests — still to decide).
5. **Keeper**: `ADMIN_EMAIL=… npm run admin:create`, sign in at `/keeper/login`, enroll TOTP (forced).
6. **Umami**: separate Vercel project + Neon DB; set `PUBLIC_UMAMI_WEBSITE_ID` and the `UMAMI_API_*` view-only user.
   Update the two rewrites in `vercel.json` if the Umami domain differs from `aqua-umami.vercel.app`.
7. **Backups**: put your `age` public key in `ops/backup-recipient.txt`; add `DATABASE_URL_UNPOOLED` to the GitHub
   `production` environment; run the "Weekly DB backup" workflow once and do the restore drill.
8. **CI integration branch** (optional): `NEON_API_KEY` secret + `NEON_PROJECT_ID` variable.

## Deviations from EXECUTIONPLAN.md (and why)

- **Fonts**: the Japanese families ship ~120 unicode-range slices per weight; inlining them made every page ≈250 KB gz.
  Their `@font-face` CSS is served once from `/fonts/jp.css` (cached, non-blocking). Zen Kaku Gothic New was dropped
  (the approved mockups set body text in Zen Maru Gothic); weights trimmed to Maru 500/700, Mincho 700.
- **Images**: source long edge 2000 px (not 2400) and a single 1600 px lightbox variant, to keep the deploy < 80 MB
  (75.6 MB). Transparent sources are near-lossless WebP. `scripts/prune-assets.ts` removes originals Astro emits but no page uses.
- **CSP**: hashes cover Astro's inline island-hydration scripts as well as the pre-paint script (computed at build).
- **Art curation**: 190 pieces. Press-article images, duplicates, animated GIFs and Gaou's pin-up / lingerie pieces
  were left out to keep the archive all-ages. Alt text was written from the images; worth a skim.
- **Dock morphing** uses CSS transitions (not GSAP Flip); the Events rope uses GSAP ScrollTrigger as planned.
- **Event schema** gained `model`, `unit`, `lore`, `award` types; the graduation-announcement entry doesn't quote a reason.
- **Board**: composer + board are one island (shared crew-number preview / optimistic insert / undo).
- **Integration tests** run on PGlite (in-process Postgres) instead of a Neon branch, so they run everywhere.
