# Analytics Rebuild Plan: why the view counter is unreliable, and how to fix it

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**   | Approved 2026-11-07 with the defaults; built on `analytics-rebuild` (see §7). Replaces `docs/plans/ANALYTICS-PLAN.md`.                                                                                                                                                                                                                                                                                                                                                                                     |
| **Why**      | The Keeper's visitor numbers are "broken and inconsistent": visits that should count don't, and numbers for the same period disagree depending on where you look. The Kotoha fan site and moekoworks_official count visits with the same idea and work fine.                                                                                                                                                                                                                                               |
| **Read**     | Here: `src/pages/api/track.ts`, `src/server/analytics.ts`, `src/lib/analytics.ts`, `db/migrations/0001_own_analytics.sql`, `src/pages/api/admin/{stats,live,insights}.ts`, `src/pages/api/cron/cleanup.ts`, `src/middleware.ts`, `astro.config.ts`. Kotoha: `api/track.js`, `lib/analytics.js`, `lib/db.js`, `public/js/public/track.js`. MoekoWorks: `src/app/api/track/route.ts`, `src/lib/track.ts`, `src/components/site/Tracker.tsx`, `src/server/admin/stats.ts`, `src/app/api/cron/daily/route.ts`. |
| **Limits**   | I couldn't see production: Vercel runtime logs and env vars answered 403 (the MCP connection isn't authorised for the `pastelsalts-projects` team), and Neon needs sign-in. So everything below comes from reading the code; §3 lists what to check on production first.                                                                                                                                                                                                                                   |
| **Breaking** | Allowed: the analytics tables are empty, so the schema, the beacon format and the Keeper data shapes may all change.                                                                                                                                                                                                                                                                                                                                                                                       |

---

## 1. Side-by-side comparison

✅ = same as a working site · ⚠️ = differs, a likely cause · ❌ = missing here

### 1.1 Browser side (sending events)

| What                     | Kotoha (works)                                 | MoekoWorks (works)                                                             | Aqua (this project)                                                                                                      |     |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --- |
| Page view sent           | Once, after the language loads, then `flush()` | On every route change (`usePathname` effect), with a 1.5 s de-dupe             | On every `astro:page-load` (first load + ClientRouter navigation), flushed at once                                       | ✅  |
| When other events go out | Page hidden / closed / 25 queued               | Same, **plus a 4 s timer** ("beacons sent during teardown are sometimes lost") | Page hidden / closed / 25 queued, **no timer**                                                                           | ⚠️  |
| Beacon body              | String (text/plain)                            | `Blob` with explicit `text/plain`                                              | String (text/plain)                                                                                                      | ✅  |
| Do Not Track / GPC       | Ignored                                        | Ignored                                                                        | **Turns tracking off entirely.** Brave sends GPC by default, and Firefox can be set to; those visitors are never counted | ⚠️  |
| Admin not counted        | Session cookie present → dropped               | Session cookie → dropped, **plus a "Don't count my visits" toggle**            | Keeper session cookie → dropped; the cookie lasts for days, so the owner's browser is invisible even on the public site  | ⚠️  |
| Visit id                 | Memory, per page load                          | Memory, per tab (SPA)                                                          | Memory, per tab (ClientRouter)                                                                                           | ✅  |

### 1.2 Endpoint (`/api/track`)

| What                       | Kotoha                                                                        | MoekoWorks                                                      | Aqua                                                                                                                  |     |
| -------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --- |
| Runtime                    | Plain Vercel function                                                         | Next.js route handler                                           | Astro on-demand route **behind `security.checkOrigin: true`** (Astro's CSRF check also applies to `text/plain` POSTs) | ⚠️  |
| Salt for the visitor hash  | `ANALYTICS_SALT` env; production throws if missing                            | **Random salt per day stored in the DB** (no env var to forget) | `ANALYTICS_SALT` env; **if missing in production every event is dropped silently** (`track.ts:44`)                    | ⚠️  |
| Hash input                 | salt + JST day + IP + UA                                                      | HMAC(daily salt, IP + UA + host)                                | salt + Manila day + IP + UA                                                                                           | ✅  |
| Answer                     | 204 always                                                                    | 400 on a bad body, 204 otherwise                                | 204 always, **no hint why something was dropped** (bot / keeper / origin / no salt / bad body / limit)                | ⚠️  |
| Origin check               | `new URL(origin).host !== host`                                               | none (cookie + bot + opt-out only)                              | Same as Kotoha, but `new URL('null')` throws a TypeError, which is **logged as an error** and drops the beacon        | ⚠️  |
| DB driver for the insert   | **Neon HTTP** (`neon()`), one statement per call, retries connection failures | Drizzle over Neon HTTP                                          | **Neon WebSocket `Pool` (`dbTx()`) kept in a module global** across serverless invocations                            | ⚠️  |
| Roll-up inside the request | Yes, in **one transaction** (`s.transaction([...])`)                          | No: nightly cron only                                           | Yes, but **three separate statements, no transaction** (delete → insert → mark rolled)                                | ⚠️  |
| Endpoint tests             | —                                                                             | —                                                               | ❌ Only `src/server/analytics.ts` is tested (PGlite); the route's header/cookie/origin/salt paths aren't              | ❌  |

### 1.3 Storage and numbers

| What                           | Kotoha                                                 | MoekoWorks                                                                        | Aqua                                                                                         |     |
| ------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --- |
| Tables                         | `analytics_events` + `analytics_daily`                 | Same + `analytics_salts`                                                          | Same two                                                                                     | ✅  |
| Where Keeper numbers come from | Rolled days from `analytics_daily` + live for the rest | **Straight from raw events for ≤ 90 days**; daily totals only for the 1-year view | Rolled + live mix for everything (two code paths that must agree)                            | ⚠️  |
| Roll-up trigger                | Lazy (track + dashboard), memo per instance            | Nightly cron, one day at a time                                                   | Lazy (track + Keeper) **and** the nightly cron, memo + 10-minute retry throttle per instance | ⚠️  |
| Environments shown             | Production only                                        | Production, **with an "all environments" switch**                                 | Production only, no switch: preview and `astro dev` visits are stored but never shown        | ⚠️  |
| "Visitors" over a range        | Sum of daily uniques                                   | Sum of daily uniques                                                              | Sum of daily uniques                                                                         | ✅  |

### 1.4 What the Keeper shows (where the inconsistency is visible)

| Number on screen             | How Aqua computes it                                                         | Problem                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| "On the site now" (top bar)  | Distinct `visit_id` with **any** event in the last 5 min                     | Different unit (visits with any event) from everything else (page views)                                         |
| Range "24h"                  | `RANGE_DAYS['24h'] = 1` → **today since midnight Manila**, not the last 24 h | The label says 24 h; at 00:30 it shows half an hour of data                                                      |
| Today / week / month cards   | Sum of daily uniques from the 1-year series                                  | Week = Monday to now, while range "7d" = the last 7 days: similar labels, different windows                      |
| Chart "visitors" line        | `series.sessions` = sum of daily **uniques**                                 | Named `sessions`, shown as visitors, while the KPI next to it uses `visits`                                      |
| Period cards' bounces / time | Always `0` (`period()` hard-codes them)                                      | Shows zero next to non-zero range numbers                                                                        |
| Discord daily digest         | `count(distinct visitor_hash)` over a **rolling 24 h**                       | The hash changes at midnight, so anyone who visits both sides of midnight counts twice; never matches the Keeper |
| Insights cards               | `eventCounts` / `eventValues`, **without calling the roll-up first**         | Fine while rolled + live agree; another place that depends on that                                               |

---

## 2. What is most likely broken (ranked)

Every one of these fails **silently** (204, no error on the page), which is why it feels like nothing makes sense.

1. **Visits are dropped before they reach the database, and nothing says why.** Any of these makes a visit vanish: `ANALYTICS_SALT` not set in Vercel Production (all events dropped); the browser has a Keeper cookie (your own visits never count); Brave / GPC / DNT (counting is off in the browser); a preview deployment or `astro dev` (stored but filtered out). Testing by visiting the site yourself hits at least one of these.
2. **Astro's `checkOrigin` sits in front of the beacon.** Kotoha and MoekoWorks have nothing similar. If the origin Astro sees on Vercel differs from the browser's (www vs apex, custom domain vs `*.vercel.app`), beacons are refused with 403 before our code runs. **Ruled out (2026-11-07):** Astro 7.3's check lets a request through when the browser sends `Sec-Fetch-Site: same-origin`, which every current browser does for its own beacons.
3. **The WebSocket `Pool` lives in a global across invocations.** After Vercel freezes and thaws a function, the pooled socket can be dead; the insert fails, the error is only logged, and the visitor sees nothing. Both working sites use Neon HTTP, which has no connection to go stale.
4. **Two sources of truth.** Rolled totals and live numbers come from different code paths, with an untransacted roll-up, per-instance memos and a 10-minute retry throttle. A roll-up that fails halfway, or runs on two instances at once, leaves daily rows that disagree with the raw events.
5. **Different definitions on one screen** (§1.4): "24h" means today, "now" counts other events, week ≠ 7 days, the digest double-counts across midnight, chart and KPI use different units.
6. **Events other than the page view can be lost** when the tab closes without `visibilitychange` (mobile Safari, killed tabs). MoekoWorks added its 4 s timer because of this.

---

## 3. Phase 0: confirm on production (≈ 30 min, before changing code)

I need you for 1–2 (or authorise the Vercel MCP for the `pastelsalts-projects` team, and sign in to Neon via `/mcp`, and I'll do it).

1. Vercel → aqua-iro-archive → Settings → Environment Variables: is `ANALYTICS_SALT` set **for Production**?
2. Neon SQL editor:
   ```sql
   select environment, event, count(*), max(occurred_at) from analytics_events group by 1, 2 order by 4 desc;
   select metric, count(*), max(day) from analytics_daily group by 1;
   ```
3. Visit the production site in a private window with no extensions (no Keeper cookie, no GPC). In DevTools → Network, find the `track` request: **204** (our code ran) or **403** (Astro's origin check refused it)?
4. Vercel runtime logs: search for `[track]`.

### 3.1 First result (Vercel logs, 2026-11-07 01:01–02:01 UTC, 32 lines)

- **Not one `POST /api/track` in the hour.** The only requests are the Keeper's pages and `/api/admin/*`, all 200. Public pages are static, so they never show up in function logs, but the beacon would: Astro's origin check runs inside the function, so even a refused beacon would be logged as a 403, and a dropped one as a 204.
- So **the browser never sent the beacon** (or nobody opened a public page in that hour). That rules out the server-side causes for this test (missing salt, keeper cookie, `checkOrigin`, the Pool): the request never got that far. What's left, all in the browser:
  1. **Tracking switched off in the browser**: Do Not Track or GPC on (Brave sends GPC by default), or the tab's first page was `/keeper/...` (`off` is decided once, when the tab loads).
  2. **An ad or tracker blocker** dropping the request to `/api/track` (a blocked request never reaches Vercel). Filter lists target paths with `track` in them.
  3. A bug in the browser code (the page view isn't queued or flushed).
- Next test: a private window with **no extensions**, open `https://aqua-iro-archive.vercel.app/` directly (not from the Keeper), DevTools → Network, filter "track". No request → (1) or (3); request shown as blocked → (2); request sent → check its status in the logs.
- Unrelated, seen in passing: `GET /api/auth/list-sessions` answers **403** on the Keeper Account page (three times). That's the session list, not analytics; it's a separate fix.

**Plan changes because of this:** the new endpoint gets a neutral path (e.g. `/api/v` or `/api/hello`, not `track`/`analytics`/`collect`); the browser checks for DNT/GPC/Keeper go away (Question 1), and the Keeper is left out by its cookie on the server instead; and a small `?debug-analytics` flag logs every queued and sent event to the browser console.

Whatever this shows, Phases 1–4 still apply; Phase 0 tells us which bug actually hit and gives a baseline to check against.

---

## 4. Target design: the MoekoWorks model, adapted

MoekoWorks is the newest and simplest of the two, and the closest to this stack (TypeScript + Drizzle + Neon HTTP). The rule: **one source of truth (raw events) for everything you look at day to day; daily totals only for the long view.**

| Piece            | New design                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driver           | `/api/track` and all analytics reads use the **Neon HTTP** `db()` (`src/server/db/http.ts`), never the WebSocket Pool. Add Kotoha's connect-retry `fetchFunction`.                                                                                                                          |
| Origin / CSRF    | `/api/track` is exempt from Astro's `checkOrigin` (it changes nothing a visitor owns). Our own host check stays, with `origin === 'null'` handled.                                                                                                                                          |
| Salt             | **Per-day random salt in a new `analytics_salts` table** (MoekoWorks). No env var to forget; old salts deleted after 2 days, so yesterday's hashes can't be rebuilt. `ANALYTICS_SALT` is removed.                                                                                           |
| Drop reasons     | Still 204, plus an `X-Track: ok` / `X-Track: dropped:<bot\|keeper\|optout\|origin\|body\|limit>` header, so DevTools shows at once why a visit didn't count.                                                                                                                                |
| Not counting you | The Keeper cookie rule stays, **and** a "Don't count this browser" switch on the Keeper Account page (a `localStorage` flag; the beacon carries `nt: 1`). DNT/GPC: **counted like on the two working sites** (the beacon has no personal data); the privacy page says so. _(Question 1)_    |
| Browser          | Keep `track()`'s API (all call sites unchanged). Add the 4 s flush timer; send a `Blob` with `text/plain`; `page_time` → `page_dwell` (MoekoWorks name).                                                                                                                                    |
| Schema           | Drop and recreate (`0002_analytics_rebuild.sql`): `analytics_events` gets CHECK constraints (event list, device, environment) like the two working sites, plus `analytics_salts`. `analytics_daily` kept for the 1-year view.                                                               |
| Numbers          | `src/server/analytics.ts` rewritten after MoekoWorks' `getStats`: today/week/month KPIs and every range ≤ 90 d **straight from raw events** in a few queries; the 1-year view reads `analytics_daily`.                                                                                      |
| Roll-up          | **Only in the nightly cron**, one finished day at a time, **in one transaction**, idempotent (delete that day + insert). No lazy roll-up in `/api/track` or the Keeper, no per-instance memos.                                                                                              |
| Definitions      | Written once at the top of `analytics.ts` and used everywhere: _page view_ = one `page_view` row; _visit_ = distinct `visit_id` with a page view; _visitor_ = distinct hash per day, summed over days; _on the site now_ = distinct visits with a **page view or dwell** in the last 5 min. |
| Ranges           | `today`, `7d`, `30d`, `90d`, `1y`. "24h" becomes **"Today"** (what it always meant). Week card renamed "This week (from Monday)".                                                                                                                                                           |
| Keeper shapes    | Free to change: `series` gets `{ pageviews, visits, visitors }`, no more `sessions`; period cards drop the hard-coded zeros or get real values.                                                                                                                                             |
| Digest           | Discord digest reports **yesterday's** visitors/visits/page views from the same function the Keeper uses, so the numbers match.                                                                                                                                                             |
| Environments     | Production by default; an "Include preview & dev" switch on the Visitors page (MoekoWorks' `allEnv`), so you can test on a preview deployment and see it.                                                                                                                                   |

---

## 5. Phases

| #   | Phase                 | Work                                                                                                                                                                                                                      | Done when                                                                                                                                                               |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Confirm on production | §3                                                                                                                                                                                                                        | We know which of §2's causes hit                                                                                                                                        |
| 1   | Schema + endpoint     | Migration `0002` (drop/recreate, CHECKs, `analytics_salts`); `/api/track` on Neon HTTP, outside `checkOrigin`, DB salt, `X-Track` header, opt-out flag; remove `ANALYTICS_SALT` from `astro.config.ts` and `.env.example` | **Endpoint tests** (new): bot, keeper cookie, opt-out, foreign origin, `Origin: null`, bad body, flood, good beacon → right rows and right `X-Track`                    |
| 2   | Browser               | `src/lib/analytics.ts`: 4 s timer, Blob body, `page_dwell`, opt-out flag, DNT/GPC per Question 1; Keeper Account switch                                                                                                   | Playwright e2e: load → navigate → hide tab; the test DB has `page_view` ×2 + `page_dwell`                                                                               |
| 3   | Numbers               | Rewrite `src/server/analytics.ts` (raw queries ≤ 90 d, daily for 1 y, the definitions above); nightly roll-up in one transaction; digest from the same function; `insights.ts` on the new reads                           | Integration tests on PGlite: one fixed set of events gives **the same numbers** in KPIs, range stats, chart, digest and the 1-year view                                 |
| 4   | Keeper                | `visitors.ts`, dashboard, Visitors and Insights pages on the new shapes; "Today" range, renamed cards, environment switch; preview fixtures (`scripts/dev/keeper-preview-db.mts`) regenerated                             | Keeper preview checked in the browser; each number shows how it's counted on hover                                                                                      |
| 5   | Docs                  | Privacy page (EN + JA) per Question 1; RUNBOOK; mark `ANALYTICS-PLAN.md` replaced                                                                                                                                         | —                                                                                                                                                                       |
| 6   | Ship                  | Branch, all tests, push; CI migrates production                                                                                                                                                                           | **You:** visit production in a clean private window → DevTools shows `X-Track: ok` → the Keeper shows the visit within a minute. Then delete `ANALYTICS_SALT` in Vercel |

Rough size: Phases 1–4 are about a day of work each for 1 and 3, half a day each for 2 and 4.

---

## 6. Questions (defaults used if not answered)

1. **Do Not Track / GPC:** count those visitors like Kotoha and MoekoWorks do (nothing personal is stored either way), or keep switching tracking off for them? _Default: count them; privacy page updated to say so._
2. **Days:** keep Asia/Manila? _Default: yes._
3. **Raw events:** keep 90 days (daily totals forever)? _Default: yes._
4. **"Don't count this browser" switch** on the Keeper Account page, as in MoekoWorks? _Default: yes._

## 7. Done (2026-11-07, branch `analytics-rebuild`)

- **Endpoint** `POST /api/hi` (was `/api/track`): Neon HTTP driver with connect-retry, per-day salt in
  `analytics_salts`, `X-Track: ok:n | dropped:<bot|keeper|optout|origin|body|empty|limit|error>`, `Origin: null`
  handled. `ANALYTICS_SALT` removed from the code: delete it in Vercel after deploying.
- **Browser** (`src/lib/analytics.ts`): no DNT/GPC/Keeper-path switch-off (Question 1 default), 4 s flush timer,
  `Blob` body, `page_time` → `page_dwell`, opt-out flag (`src/lib/analytics-optout.ts`), `?debug-analytics`.
- **Numbers** (`src/server/analytics.ts`): definitions in the file header; the last 90 days (and anything not rolled
  yet) always from raw events; the roll-up is cron-only, one atomic statement, and uses the same query; ranges
  `today / 7d / 30d / 90d / 1y`; `env=all` for preview & dev; the digest reports yesterday from the same function.
- **Keeper**: "Today" range on Visitors and Insights, "Include preview & dev", hover text on how each number is
  counted, "Don't count this browser" on My account.
- **Migration** `0002_analytics_rebuild.sql`: empties both analytics tables, adds `analytics_salts` and CHECKs.
- **Checked:** 75/75 tests, including new endpoint tests and one that checks periods, ranges, chart, digest and
  the 1-year view agree before and after the roll-up and after pruning; `astro check`, eslint and prettier clean;
  in the Keeper preview, a local visit was stored (`204 ok:1`), the Today card and range matched (42), the
  preview/dev switch added exactly one visit, and the opt-out stopped sending.
- **Left for you:** deploy, then a clean private window on production with `?debug-analytics` → `ok:1` → the visit
  shows in the Keeper; then delete `ANALYTICS_SALT` in Vercel. Separate issue: `/api/auth/list-sessions` → 403.
