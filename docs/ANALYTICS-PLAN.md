# Analytics Plan: drop Umami, count visits ourselves (the Kotoha way)

|            |                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status** | Approved 2026-11-03 with the defaults; in progress on `own-analytics`.                                                                                                                                        |
| **Why**    | The self-hosted Umami errors in the Keeper, and it is one more app, database and set of secrets to keep alive. The Kotoha fan site counts visits itself and works.                                            |
| **Model**  | `../kotoha-fansite`: `api/track.js` (the endpoint), `lib/analytics.js` (checks, daily totals, dashboard numbers), `public/js/public/track.js` (the browser side), `db/migrations/0001_init.sql` (two tables). |

## 1. How Kotoha does it (read on 2026-11-03)

- **Browser:** events are queued in memory and sent in batches with `sendBeacon` to its own `/api/track` when the
  page is hidden or closed (or every 25 events). A random visit id lives only in memory for that page load. No
  cookies, nothing stored in the browser.
- **Endpoint:** always answers 204, so tracking can never break the page. It drops bots (user-agent list),
  signed-in admins (session cookie present), other sites (Origin check) and floods (200 events per visitor per
  5 minutes). A **visitor hash** = SHA-256 of a secret salt + the day + IP + browser, cut to 32 characters: it
  counts unique visitors per day but can't follow anyone across days, and the IP is never stored. Country comes
  from Vercel's `x-vercel-ip-country` header.
- **Storage:** `analytics_events` (raw events, kept 90 days) and `analytics_daily` (one row per day × metric ×
  value, kept forever). Finished days are rolled into daily totals automatically the first time someone tracks
  or opens the dashboard each day; no cron needed. Only production traffic counts.
- **Dashboard:** today / week / month, daily/weekly/monthly series, and every breakdown, from one SQL query.

## 2. What we build (adapted)

| Piece        | Here                                                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser      | `src/lib/analytics.ts` keeps its `track(name, props)` API; only its inside changes from `window.umami.track` to the Kotoha queue + `sendBeacon('/api/track')`. Adds a `page_view` on every load and every page change (ClientRouter). | **All 34 existing `track()` calls keep working unchanged.** No external script: the Umami `<script>` tag and the `/s/*` rewrites go.                                                                                                                          |
| Endpoint     | `src/pages/api/track.ts`                                                                                                                                                                                                              | Same rules as Kotoha: 204 always, bots/admins/other origins/floods dropped, daily-salted visitor hash, country from Vercel. Admins are recognised by the Keeper session cookie (`aia-keeper…`). Do Not Track is honoured, as the privacy page promises today. |
| Tables       | One new migration: `analytics_events` (time, event, path, visit id, visitor hash, device, browser, country, referrer host, up to 5 small properties as JSON) and `analytics_daily` (day, metric, dimension, value)                    | Generic events instead of Kotoha's fixed columns, because this site sends 34 kinds of events with properties. Raw rows kept 90 days, daily totals forever.                                                                                                    |
| Daily totals | `src/server/analytics.ts` (port of Kotoha's `lib/analytics.js`): one aggregate query, lazy roll-up, live numbers for days not rolled yet                                                                                              | Days in the Keeper's time zone (Asia/Manila), weeks from Monday. The nightly clean-up cron also triggers the roll-up and prunes old rows.                                                                                                                     |
| Keeper       | `src/server/umami.ts` is replaced by functions with the **same output shapes** (`visitors`, `eventProperty`, `eventCounts`, `activeNow`)                                                                                              | So the dashboard, Visitors and Archive insights pages stay exactly as built. "On the site now" = distinct visits in the last 5 minutes. Breakdowns gain Kotoha's per-hour data; the 7 × 24 grid comes from our own table.                                     |
| Secret       | `ANALYTICS_SALT` (new, any long random string, set once in Vercel)                                                                                                                                                                    | Kept separate from the board's `IP_HASH_SECRET` on purpose.                                                                                                                                                                                                   |
| Privacy page | The "Self-hosted Umami" paragraph is rewritten (EN + JA): counted by the site itself, no cookies, IPs never stored, daily-changing hash, admins not counted, Do Not Track honoured                                                    |                                                                                                                                                                                                                                                               |

## 3. What gets removed from the code

`src/server/umami.ts`, the Umami `<script>` in `Base.astro`, the `/s/ui.js` and `/s/api/send` rewrites in `vercel.json`, the `UMAMI_*` and `PUBLIC_UMAMI_*` env fields in `astro.config.ts` and `.env.example`, the Umami lines in `docs/RUNBOOK.md`, and the Umami-only bits of the preview fixtures.

## 4. What you delete by hand afterwards (I can't reach these)

1. Vercel: the **aqua-umami** project (Settings → Advanced → Delete Project).
2. GitHub: your **umami** fork.
3. Neon: the **umami** database you created for it.
4. Vercel, aqua-iro-archive project: the env vars `UMAMI_API_URL`, `UMAMI_API_KEY`, `PUBLIC_UMAMI_WEBSITE_ID` (and any `UMAMI_API_USER` / `UMAMI_API_PASSWORD`).
5. Optional: the Umami Cloud account from earlier.

Do these **after** the new version is live, so nothing breaks in between. The one day of Umami data is not carried over.

## 5. Order of work

1. Migration + `src/server/analytics.ts` + `/api/track`, with integration tests on PGlite (the same way the board is tested).
2. Browser side in `src/lib/analytics.ts`; remove Umami from the site.
3. Swap the Keeper's data source; preview with sample events.
4. Privacy page, runbook, `.env.example`.
5. Build, all tests, push a branch.
6. **You:** add `ANALYTICS_SALT` in Vercel, then I run the migration on production (or you run `npm run db:migrate`; it only adds the two tables), merge, deploy, and check that a visit shows up in the Keeper.
7. **You:** delete the Umami pieces (§4).

## 6. Questions (defaults used if not answered)

1. Days in **Asia/Manila** (yours, as the rest of the Keeper) or JST (Aqua's)? _Default: Asia/Manila._
2. Keep **raw events 90 days** like Kotoha? _Default: yes._
