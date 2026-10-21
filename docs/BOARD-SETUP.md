# Opening the message board (寄せ書き)

The board on `/messages` is **read-only** until you do the steps below. Posting was paused on purpose before
launch for two reasons:

1. The bot check (Cloudflare Turnstile) still uses Cloudflare's **test keys**, which let every bot through.
2. There is **no admin (keeper) account** yet, so nobody could remove a bad note.

While paused, visitors see "The board is resting today. Please come back soon ⚓" and can still read notes.
Do the steps in order; the whole thing takes about 15 minutes.

---

## 1. Create the Turnstile keys (free, ~2 min)

1. Sign in at <https://dash.cloudflare.com> (a free account is enough).
2. Left menu → **Turnstile** → **Add widget**.
3. Fill in:
   - **Widget name:** `Aqua Iro Archive`
   - **Hostnames:** `aqua-iro-archive.vercel.app` (add your custom domain too if you ever add one)
   - **Widget mode:** **Managed**
   - Pre-clearance: leave off
4. Create it and copy the two values:
   - **Site key** (public, starts with `0x4…`)
   - **Secret key** (private — never commit it or paste it in an issue)

## 2. Put the keys in Vercel and redeploy

The site key is built into the `/messages` page, so a **redeploy is required** after changing it.

**Option A — Vercel dashboard:** Project `aqua-iro-archive` → **Settings → Environment Variables** →
edit `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for **Production** → save → **Deployments** → the newest
production deployment → **⋯ → Redeploy**.

**Option B — terminal**, from this folder (each command asks you to paste the value):

```bash
vercel env rm TURNSTILE_SITE_KEY production --yes
vercel env add TURNSTILE_SITE_KEY production
vercel env rm TURNSTILE_SECRET_KEY production --yes
vercel env add TURNSTILE_SECRET_KEY production
vercel --prod
```

Keep `.env.production.local` in step if you use it locally: replace the two `TURNSTILE_*` values there too
(single-quoted, file stays mode 600, it is gitignored).

> Local development and CI keep using Cloudflare's testing keys from `.env.example` — don't change those.

## 3. Create your keeper (admin) account

Sign-up is disabled in the app; the account is created once from your machine against the production
database. From this folder:

```bash
set -a; . ./.env.production.local; set +a
ADMIN_EMAIL=you@example.com npm run admin:create
```

- It asks for a **passphrase (14+ characters)** twice. It is typed in, never stored in a file.
- Then open <https://aqua-iro-archive.vercel.app/keeper/login>, sign in, and **set up two-factor** (TOTP —
  any authenticator app). The keeper area forces this on first sign-in. Save the backup codes it shows once.
- Lost the authenticator later? `tsx scripts/reset-2fa.ts` (same `.env.production.local` loaded) resets it.

## 4. (Recommended) Alerts and contact

- **Discord alerts:** create a webhook in a private Discord channel (Channel settings → Integrations →
  Webhooks) and set it as `DISCORD_WEBHOOK_URL` in Vercel (Production). Held notes, report thresholds and
  raid detection post there. Redeploy afterwards.
- **Removal-request contact:** the Credits and Privacy pages link to the Moeko Works contact form
  (https://moekoworks.vercel.app/contact); nothing to set.

## 5. Open the board

1. Sign in at `/keeper` → **Settings**.
2. Untick **Pause posting** and save. This takes effect immediately — no redeploy.
3. Open `/messages` in a private window: the composer appears instead of "resting today", the Turnstile check
   shows, and a test note pins with a crew number. Undo it within 10 minutes with the **Undo** button, or remove
   it from **/keeper → Queue / Notes**.

To close it again at any time (e.g. during a raid): `/keeper → Settings → Pause posting`.

---

## What protects the board once it's open

- Turnstile on every post (step 1–2).
- Per-visitor and site-wide rate limits; visitor IPs are only stored as salted hashes.
- Word filter (obscenity + the site's own list) — matches are blocked or held for review.
- **Raid detection:** above `raid_posts_5m` posts in 5 minutes (default 40) new notes are held, and you get a
  Discord alert. **Newcomer hold** (Settings) can hold every new note until you approve it.
- Reports from readers put a note under review after enough reports.
- Nothing is hard-deleted except by an explicit, typed-confirmation **Purge** in the keeper area.

## Checklist

- [ ] Turnstile widget created for `aqua-iro-archive.vercel.app`
- [ ] `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` replaced in Vercel (Production) and redeployed
- [ ] Keeper account created, signed in, two-factor set up, backup codes saved
- [ ] (optional) `DISCORD_WEBHOOK_URL` set, redeployed
- [ ] **Pause posting** unticked in `/keeper → Settings`
- [ ] Test note posted from a private window, then undone
