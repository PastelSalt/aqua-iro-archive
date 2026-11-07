# Keeper Update Plan: adapting the Kotoha admin

|               |                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | **Approved 2026-11-03** with the §11 defaults; in progress on `keeper-update`.                                                                                                                                                           |
| **Goal**      | Bring `/keeper` up to the Kotoha admin's level of layout, visual polish and completeness, adapted to what this site actually has (a message board, an archive built from files, Umami analytics, one admin) and to Aqua's harbour theme. |
| **Reference** | `../kotoha-fansite`: `public/admin.html`, `public/css/admin.css`, `public/js/admin/*.js`, `docs/ADMIN_UI_PLAN.md`. Viewed rendered on 2026-11-03 through a local preview with fake data (screens described in §1).                       |
| **Branch**    | `keeper-update` from `main`; merge to `main` (= production) only with the owner's OK.                                                                                                                                                    |

---

## 0. Ground rules

1. **Adapt, don't port.** Kotoha is a vanilla-JS single-page app with content CRUD, uploads and several accounts. The Keeper stays as server-rendered Astro pages with small scripts. We take Kotoha's **layout, visual formatting, component set and level of finish**, not its code or its features we don't need (§4.3).
2. **Aqua's theme, calm.** Same idea as Kotoha's "calm brand, not scrapbook": the Keeper borrows the site's tokens (navy deep, crest gradient, paper, wash, display font, Phosphor icons) and a few signature shapes (the ticket title from the page-change shutter), but no stickers, tilts, waves on every card or animation for show.
3. **Data first from what exists.** Every number comes from the board database, the settings table, the content collections, or Umami's API. The few server additions are listed in §5 and are read-only.
4. **No new libraries, no new outside origins.** Charts are hand-drawn SVG (like Kotoha's), which **removes** `uplot`. Icons come from the site's own `Icon.astro` (Phosphor), not a CDN, so the CSP stays as it is.
5. **Every behaviour stays:** queue keys (J/K/A/R/X), the 5 s undo, bulk actions, the typed purge confirmation, the CSV export, settings saving, the word-list tester, the alert test, 2FA on every sign-in.

---

## 1. What makes the Kotoha admin better (observed)

### 1.1 Shell

- **Top bar:** logo + "Admin" chip · JP/EN pill · user badge (avatar, name, role pill) · **View site** · **Sign out**. Light paper bar, not a solid colour block.
- **Sidebar:** a floating paper panel on the left with **grouped links** (Dashboard / _Content_ / _Records_ / _Account_), an icon on every link, a small decorated label per group, and a filled pill for the current page.
- **Phones:** the sidebar becomes a drawer with a dimmed backdrop; tap outside, Esc or changing page closes it; focus moves in and back.
- **Page background:** the site's brand colour with a faint dot pattern, so white cards stand out.

### 1.2 Dashboard, top to bottom

1. **Welcome card:** "Hello, moeko!" title, one-line intro, today's full date with the time zone.
2. **Site content tiles:** one per section, each with its sidebar icon, the published count in big type, a grey "N drafts" pill only when there are drafts, a published/draft split bar, and an arrow; the whole tile links to its page.
3. **Visitor KPI strip:** _Today · This week · This month_, each with visits big and "N unique visitors" small. Visually different from the content tiles (pink numbers vs green).
4. **Visits chart:** a large bar chart (visits light, unique visitors dark inside), Daily/Weekly/Monthly tabs in the panel header, a total line for what is shown ("1,583 visits · 952 unique visitors in this chart"), grid values, hover/tap/arrow-key tooltip, and a legend.
5. **"Details for" bar:** the 7/30/90/365-day range control sits **directly above everything it changes**, with "990 visits in this period". Range-based KPIs follow (average visit length, average loading time).
6. **Breakdown cards in three labelled groups:** _Audience_ (devices, browsers, languages, countries with "80% from Japan"), _Traffic_ (sources, busiest hours with the peak highlighted), _Engagement_ (sections reached, video plays, outbound clicks, news links, artworks). Every card is a **ranked bar list**: rank number, label, value right-aligned, a filled track.
7. **Privacy note** at the bottom (what is and isn't collected).

### 1.3 Shared components (every screen)

- **Page head:** sticker-style title, one-line hint under it, actions on the right.
- **Toolbar:** segmented filters (All / Published / Draft) and selects, sized like buttons.
- **Item rows:** icon or thumbnail · title · meta line of pills and dates · short text · actions on the right. Drafts get a dashed outline.
- **States:** skeleton placeholders at final size while loading (nothing jumps), a styled empty box ("Nothing here yet" with the site's motif), an error box with an icon and **Retry**.
- **Feedback:** toasts with an icon per kind; a shared dialog with header, body and sticky actions; confirmations that can ask for a reason; "Load more" paging; a "waking up the database" hint when a call is slow.

### 1.4 Completeness

Every screen has a hint, an empty state, an error state, a loading state and keyboard focus styles. Account self-service exists (change password, sign out other sessions). Numbers are formatted (`1,583`, `1 min 20 s`, `3.4 s`) and dates are shown in one stated time zone.

---

## 2. The Keeper today

| Page     | What it has                                                                                                                                               | Problems                                                                                                                                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell    | Solid navy top bar, "⚓ KEEPER", six text links, Sign out                                                                                                 | No grouping, no icons, no View site link, no sign of who is signed in or that 2FA is on; on phones the links just wrap                                                                                                                                                                                                 |
| Overview | Board numbers (`<dl>`), a uPlot line chart of notes/reports, Umami numbers, a uPlot pageviews/visitors chart, five top-10 tables, eight "insights" tables | Raw API keys as labels (`visitors`, `totaltime` in plain seconds); raw IDs in insights (YouTube IDs, stream IDs, art IDs); every block looks the same; the range tabs at the top affect some blocks but not "Last cron"/"Posting"; empty tables show "—" with no explanation; no loading or error state; inline styles |
| Queue    | Reported/Held tabs, keyboard moderation, bulk, undo, per-note reasons and reporter notes                                                                  | Works well; looks plain; the key legend is a line of text; "Nothing waiting. ⚓" is a bare card                                                                                                                                                                                                                        |
| Notes    | Filter form (status, text, dates), table, restore, typed purge                                                                                            | Plain table; status shown as raw words (`under_review`)                                                                                                                                                                                                                                                                |
| Audit    | Action filter, table, CSV export                                                                                                                          | Raw action codes (`settings_change`), raw actor IDs, JSON detail                                                                                                                                                                                                                                                       |
| Settings | Board switches, moderation numbers, word list with tester, alerts, account                                                                                | Raw `snake_case` labels; one long page; no grouping by purpose                                                                                                                                                                                                                                                         |
| Errors   | Latest 200 errors with route, ISO time, message, stack                                                                                                    | ISO timestamps, no grouping or counts, no relative time                                                                                                                                                                                                                                                                |
| Account  | (only inside Settings) and the 2FA pages                                                                                                                  | No place to see 2FA status, make new backup codes, change the passphrase or sign out other sessions, all of which the 2FA lock-out on 2026-11-03 showed we need                                                                                                                                                        |

Times are also inconsistent: Umami queries use Asia/Manila, the queue prints JST, Errors prints ISO UTC.

---

## 3. Design direction

- **Page:** the site's `--wash` at low strength with a faint seigaiha (wave-scale) dot pattern, the Keeper's version of Kotoha's dotted pink page.
- **Cards:** `--paper`, 1 px border, the site's soft shadow, `--r-card` radius. A dashed outline only where it means "something goes here" (empty states) or "not live" (held / under-review notes).
- **Titles:** page titles as a small **navy ticket** (the page-change shutter's ticket: paper card, crest tape, anchor), the Keeper's version of Kotoha's green sticker. Section headings use an icon and the display font.
- **Colour meaning, fixed everywhere:**

  | Colour              | Means                                          |
  | ------------------- | ---------------------------------------------- |
  | navy                | the board and the archive (things on the site) |
  | pink (`--pink-ink`) | visitors                                       |
  | cyan / mint         | engagement (features used)                     |
  | amber               | needs attention (held, under review, warnings) |
  | red                 | removed, errors, danger buttons                |

- **Numbers:** display font, tabular figures, formatted (`1,583`, `1 min 20 s`, `2.4 s`); a small ▲/▼ compared with the previous period where Umami gives one.
- **Time:** one time zone everywhere, stated on screen (default Asia/Manila, the keeper's; see Q2).
- **Motion:** none beyond hover/focus states and a short fade from skeleton to content; nothing under reduced motion.

---

## 4. Shell and navigation

### 4.1 Top bar (paper, sticky)

`⚓ KEEPER` wordmark + "Aqua Iro Archive" · **live dot** (active visitors right now, from Umami `active`) · user badge (email initial, "Admin", a green **2FA on** pill) · **View site** · **Sign out**.

### 4.2 Sidebar (floating paper panel, grouped, with Phosphor icons)

| Group       | Links                                                   |
| ----------- | ------------------------------------------------------- |
| (top)       | Dashboard                                               |
| **Board**   | Queue (with a count badge when > 0) · Notes · Word list |
| **Site**    | Visitors · Archive insights                             |
| **Records** | Audit log · Errors (count badge for the last 24 h)      |
| **Account** | Settings · My account                                   |

Count badges are the queue and error numbers the dashboard already loads. Phones: the Kotoha drawer behaviour (backdrop, Esc, tap outside, focus in/out).

### 4.3 What we deliberately don't copy

Multiple accounts and roles (single admin) · content add/edit forms (the archive is built from files in the repo) · gallery uploads · the JP/EN switch (English only unless Q3 says otherwise) · confetti · Lucide/Animate.css from a CDN (CSP).

---

## 5. Data: what exists, what is added

| Source                                                                                                 | Gives                                                                                       | Status                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `boardStats`, `queue`, `notesList`, `auditList`, `settings`, `app_errors`                              | Held / under review / removed / errors, notes-and-reports per day, cron time, posting state | Exists                                                      |
| Content collections (`streams`, `clips`, `songs`, `arts`, `events`, Talk scripts)                      | Counts per section; **names for the IDs** the analytics events carry                        | Exists at build time; a small server helper maps ID → title |
| Umami `stats` (+ `comparison`)                                                                         | Visitors, visits, pageviews, bounce rate, total time, and the previous period for ▲/▼       | Exists; we only read `comparison` now                       |
| Umami `stats` × 3 fixed periods                                                                        | _Today / This week / This month_ strip                                                      | **Add**: three cached calls                                 |
| Umami `pageviews` (unit day/week/month)                                                                | Visits chart with Daily / Weekly / Monthly                                                  | Exists (day only today); add the unit switch                |
| Umami `metrics` (path, referrer, country, device, browser, os, language)                               | Breakdown bar lists                                                                         | Exists (os, language **added**)                             |
| Umami `sessions/weekly`                                                                                | 7 × 24 grid of sessions → busiest hours and days                                            | **Add**                                                     |
| Umami `active`                                                                                         | Visitors on the site right now                                                              | **Add**                                                     |
| Umami `event-data/values`                                                                              | Archive insights per event; the site already sends 34 event types (§6.3)                    | Exists for 8; **add** the rest                              |
| better-auth (`listSessions`, `revokeOtherSessions`, `changePassword`, `twoFactor.generateBackupCodes`) | My account page                                                                             | Exists in the library; pages added                          |

All of it goes through the existing `/api/admin/stats` (extended, still admin-only, still 5-minute private cache) plus one small `/api/admin/insights` for the archive-insights page so the dashboard stays fast.

---

## 6. Screens

### 6.1 Dashboard (replaces Overview)

Numbers in the sketch are examples.

```
┌ ⚓ Welcome back ──────────────────────────────── Mon, 3 Nov 2026 · PHT ┐
│ "Everything on the archive at a glance."   ● 3 on the site now        │
├ NEEDS YOU ─────────────────────────────────────────────────────────────┤
│ [⚠ 2 reported notes →]  [⏸ 1 held note →]  [✖ 4 errors in 24 h →]   │  ← only cards with > 0; else one "All calm ⚓" card
├ THE BOARD ─────────────────────────────────────────────────────────────┤
│ [Visible 128 | split bar] [Held 1] [Under review 2] [Removed 30 d 3]   │
│ Posting: open · newcomer hold off · last clean-up 03:11 (PHT)          │
│ Notes & reports chart (bars, 7/30/90 d)                                 │
├ THE ARCHIVE ───────────────────────────────────────────────────────────┤
│ [Streams 639] [Clips 30] [Songs 41] [Art 190] [Events 52] [Talk 21]    │  ← each links to its public page
├ VISITORS ──────────────────────────────────────────────────────────────┤
│ Today 34 (20 unique) · This week 240 · This month 990                   │
│ ┌ Visits ─────────── 1,583 visits · 952 unique ── [Daily|Weekly|Month]┐ │
│ │ bar chart, hover/tap/arrow tooltip, legend                          │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├ DETAILS FOR [7 d | 30 d | 90 d | 1 y] · 990 visits in this period ─────┤
│ Avg visit 1 min 20 s ▲12% · Bounce rate 41% ▼3% · Pages per visit 2.4  │
│ ── Audience:  Devices · Browsers · Languages · Countries (% from JP)    │
│ ── Traffic:   Sources · Top pages · Busiest hours (peak highlighted)    │
│ ── Engagement: Embeds played · Streams opened · Talk · Web vitals       │  ← top 5 each, "See all →" to Archive insights
├────────────────────────────────────────────────────────────────────────┤
│ 🛡 Privacy: no cookies; IPs are hashed for the board and never stored …  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Needs you** is new and replaces Kotoha's drafts pill: the Keeper's real "waiting" items are reports, held notes and errors.
- **Archive tiles** take the place of Kotoha's content tiles. There are no drafts here (the archive is built from files), so the foot of each tile shows what's newest instead ("latest: 2024.08.28").
- **Board tiles** keep Kotoha's split bar (visible vs not visible).
- Labels are human ("Bounce rate", "Total time 6 h 12 min"), never API keys.

### 6.2 Visitors (new page, the full view)

The dashboard's visitor blocks without the top-5 limit: every breakdown with up to 25 rows, OS and screen added, the 7 × 24 **busiest hours and days** heat grid, top pages with titles instead of paths ("NO.05 Streaming" rather than `/streaming`), referrers with the site name, countries with their full names and flags. Range and Daily/Weekly/Monthly as on the dashboard. A visible note if every visit shows the same country (the proxy check from 2026-11-03).

### 6.3 Archive insights (new page, from the events the site already sends)

Grouped like Kotoha's Engagement, every ID turned into a title:

| Group              | Cards                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Listening**      | Embeds played (song titles) · BGM plays · Discography tab and view used                                                                                               |
| **The archive**    | Streams opened (titles + year) · Stream searches (top terms) · Year/tag filters · Clips filters · Art opened (titles) · Art sections · Events opened · Outfits picked |
| **Talk with Aqua** | Conversations started vs finished (completion %) · Top choices · "Take me there" jumps · Album opened                                                                 |
| **Site features**  | Aqua Time trips (to which month) · Tour finished vs skipped (and at which step) · Motion / language / BGM toggles · Dock chapter clicks (click / key / Talk)          |
| **Board**          | Notes posted by outcome (published / held / errors by code) · Reports by reason · Undo used                                                                           |
| **Health**         | Web vitals per metric (LCP / INP / CLS / FCP / TTFB), good / needs improvement / poor split · 404 paths (`not_found`) · Outbound clicks by site                       |

### 6.4 Queue

Same function and keys, Kotoha row format: crew number badge, status pill (amber), reason pills with counts, reporter notes as a quote list, relative and absolute time, actions on the right; a **key legend as keycaps** in the page head; selected rows get the navy outline; bulk bar becomes a sticky toolbar when anything is selected; the empty state is a styled "All calm ⚓" box.

### 6.5 Notes

Toolbar: segmented status (All / Visible / Held / Under review / Removed) + search + date range; rows instead of a table on phones; human status words; restore and purge stay where they are, purge keeps the typed confirmation in the shared dialog.

### 6.6 Audit log (Kotoha's Activity log)

Row per action with an icon per action type (approve ✓, remove, restore, settings, word list, pause/resume, sign-in, 2FA reset), a human label ("Changed settings"), "by the keeper" or "by the system / script", time, and the detail as readable text ("report_threshold 3 → 4"), not JSON. Action filter as a select; **Load more** paging instead of the fixed 300; CSV export button in the page head.

### 6.7 Errors

Grouped by route and message with a count and "first / last seen", relative times, expandable stack, a filter for the last 24 h / 7 d / all; an empty state that says "No errors ⚓".

### 6.8 Settings, split by purpose

- **Board** (pause, newcomer hold) as proper toggle switches with one-line explanations.
- **Moderation numbers** with human labels ("Reports before a note hides") and the current `snake_case` key shown small for reference.
- **Word list** on its own page (linked in the sidebar): table → rows, the tester as a panel beside it.
- **Alerts**: the Discord test button and what triggers an alert.

### 6.9 My account (new)

- Signed-in email · **2FA on** pill · when it was set up.
- **Make new backup codes** (asks for the passphrase; shows the 10 codes once with Copy / Download as .txt).
- **Change passphrase.**
- **Sessions:** this device and others with time and browser; "Sign out everywhere else".
- **Recovery note:** what to do if locked out (the `admin:check-2fa` and `reset-2fa` scripts), so the 2026-11-03 fix is written down where it's needed.

### 6.10 Sign-in, 2FA and 2FA setup pages

**Kotoha's sign-in page (viewed rendered on 2026-11-03):** one centred paper card on the brand's dotted page; logo, then a sticker title ("Admin sign in"); labelled fields; a "Show password" checkbox; a full-width green button; a footer row with "View site" and the JP/EN switch, under a dashed rule; a clover tucked on two corners. In behaviour: an already signed-in admin skips straight to the panel; the button turns into "Signing in…" and is disabled while it works; after a failed attempt the password is cleared and refocused; a "Waking up the database…" hint appears when the call is slow; the form posts (never GET) even before its script loads, so a password can't land in the URL. Kotoha has no 2FA, so the two 2FA pages adapt the same card.

**Shared card (all three pages):** a paper card (`min(420px, 100%)`) centred on the faint wash with the seigaiha dots; the channel logo, then the navy **ticket title** with crest tape; a small step line under it; a footer row under a dashed rule with **View site** on the left and **Sign out / start over** on the right where it applies; the Moeko flower tucked on one corner and an anchor on the other (decorative, `aria-hidden`). Phones: full-width card with 16 px gutters. Reduced motion: no entry animation.

**Sign in (`/keeper/login`, step 1 of 2)**

- Fields: **Email** (`autocomplete=username`, no autocapitalise or spellcheck) and **Passphrase** (`current-password`) with a **Show passphrase** checkbox.
- Button: "Sign in" → "Signing in…" and disabled while working.
- Messages in the card, never only in the console: wrong email or passphrase ("That email and passphrase don't match."), too many attempts with the wait time (429), server problem (5xx, "not a wrong passphrase"), slow-call hint after 2.5 s ("Waking up the database…").
- After an error: passphrase cleared and focused.
- Already signed in (session with 2FA done): go straight to `/keeper`. Signed in but 2FA not set up yet: go to setup.
- `method="post"` on the form so a native submit can never put the passphrase in the URL.

**Two-factor (`/keeper/two-factor`, step 2 of 2)**

- One code field in large tabular digits (`inputmode=numeric`, `autocomplete=one-time-code`, so phones offer the code from the authenticator or SMS keyboard); spaces are ignored; **submits by itself once 6 digits are in**.
- **"Use a backup code instead"** swaps the field for the backup-code field (and back), instead of showing both at once; the swap moves focus.
- Clear outcomes (the 2026-11-03 fix kept): wrong code, too many attempts (with the wait), server problem (not a wrong code), and a short line on what to do if the phone is lost ("use a backup code; if those are gone, see the recovery steps in RUNBOOK"; the steps are written into `docs/RUNBOOK.md` in K5).
- Footer: **Start over** (signs out of the half-finished sign-in and returns to step 1).
- Optional **"Trust this browser for 30 days"** checkbox (better-auth `trustDevice`): see Q6. Default: not offered.

**Two-factor setup (`/keeper/two-factor/setup`, three numbered steps on one card)**

1. **Confirm your passphrase** → "Show QR code".
2. **Scan the QR code** in an authenticator app; "Can't scan?" shows the secret in groups of four with a **Copy** button.
3. **Save your backup codes**: shown in a two-column grid with **Copy all** and **Download .txt**; a checkbox "I've saved them somewhere safe" must be ticked before step 4 unlocks.
4. **Enter the 6-digit code** (same auto-submitting field as above) → "Turn on two-factor" → a success state with "Go to the Keeper".

Each step shows done / current / next in a small step rail (1 · 2 · 3 · 4), so it's clear where you are; finished steps collapse to one line.

**What we don't copy from Kotoha:** the JP/EN switch (Q3), username sign-in (the Keeper signs in by email), the clover art (the Keeper uses the Moeko flower and the anchor).

---

## 7. Shared components to build (`src/components/keeper/`)

`KeeperShell` (top bar + sidebar + drawer) · `PageHead` (ticket title, hint, actions) · `Tile` (icon, number, sub-line, split bar, link) · `Kpi` (label, value, ▲/▼) · `BarList` (ranked bars) · `BarChart` (SVG, tooltip, keyboard) · `HeatGrid` (7 × 24) · `Segmented` · `Row` (icon / thumb, title, meta pills, text, actions) · `StateBox` (empty / error + Retry) · `Skeleton` · toast with icons · shared confirm dialog (with optional reason / typed confirmation) · number, duration and time formatters (one time zone).

---

## 8. Files

**Will change:** `src/layouts/Keeper.astro`, `src/styles/keeper.css` (rewritten around the tokens), every `src/pages/keeper/*.astro`, `src/pages/api/admin/stats.ts`, `src/server/umami.ts` (fixed periods, weekly, active, units, more metrics), `src/scripts/keeper-client.ts` (toast with icons, dialog), `package.json` (remove `uplot`).

**New:** `src/components/keeper/*`, `src/pages/keeper/{visitors,insights,words,account}.astro`, `src/pages/api/admin/insights.ts`, `src/server/labels.ts` (ID → title from the content collections).

**Will not change:** the public site, the board's API and database, moderation logic, auth configuration, the CSP, the tracking calls.

---

## 9. Risks

| Risk                                                 | Mitigation                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Breaking a moderation flow while restyling the queue | Logic untouched; an e2e test for J/K/A/R + undo + bulk on a seeded test database before merging            |
| Many Umami calls make the dashboard slow             | One server request, calls in parallel, 5-minute cache; skeletons at final size; insights on their own page |
| Umami event-data values differ between versions      | Field shapes isolated in `umami.ts` (already the rule); each card falls back to "No data yet"              |
| ID → title lookups miss renamed or removed items     | Show "(removed item #id)" as Kotoha does                                                                   |
| Removing uPlot changes chart behaviour               | The SVG chart copies Kotoha's tested behaviour (real-width drawing, tooltip, arrow keys, resize redraw)    |

---

## 10. Phases and checklist

Legend: `[ ]` todo · `[x]` done and verified · ✋ owner review

- [x] **K0** ✋ Approved 2026-11-03 with the §11 defaults (after §6.10 was expanded to the sign-in, 2FA and setup pages)
- [x] **K1** Tokens and shell: `keeper.css` rewrite, top bar, grouped sidebar, phone drawer, page head, state boxes, skeletons, toasts. Every existing page keeps working inside the new shell
- [x] **K2** Dashboard: needs-you cards, board tiles and chart, archive tiles, visitor strip, visits chart, range details with grouped bar lists, privacy note; `stats.ts` / `umami.ts` additions; uPlot removed
- [x] **K3** Visitors and Archive insights pages; `labels.ts`; `insights.ts`
- [x] **K4** Queue, Notes, Audit, Errors, Settings split and Word list in the new components
- [x] **K5** My account (backup codes, passphrase, sessions, recovery note); sign-in and 2FA pages restyled
- [~] **K6** QA: 1920 / 1366 × 768 / 1024 / 768 / 390 px; keyboard-only pass; reduced motion; contrast AA; no CSP errors; regression of sign-in + 2FA, every queue action, purge, restore, settings, word list, CSV; Chromium and WebKit e2e
- [ ] **K7** ✋ Owner checks the preview → merge to `main` → check production `/keeper`

---

- Progress 2026-11-03: K1–K5 built on `keeper-update`. Checked in the local preview (`npm run keeper:preview`:
  PGlite sample data, stand-in admin, sample Umami numbers; dev-only, verified absent from the production
  bundle) at 1366×768 and 390×844: every page, the phone drawer (Esc, focus return), the purge dialog end to
  end. Unit/integration 60/60, e2e 113 passed (Chromium + WebKit). Not checkable in the preview: real sign-in,
  2FA, sessions and backup codes (they need the production auth), and live Umami numbers; check those on
  production after merging. Not done from the plan: per-metric web-vitals split (Umami's values endpoint gives
  ratings and metric names separately), the Errors "acknowledge" idea, JP/EN (English only by default).

## 11. Questions for the owner (defaults used if not answered)

1. **Look:** paper cards on a faint wash with navy ticket titles (as in §3), or keep the navy top bar look and only fix layout? _Default: §3._
2. **Time zone** for the Keeper: Asia/Manila (yours), JST (Aqua's), or both? _Default: Asia/Manila, labelled._
3. **Language:** English only, or JP/EN like Kotoha? _Default: English only._
4. **Pages:** a separate Visitors page and Archive insights page (dashboard shows top 5), or everything on the dashboard like Kotoha? _Default: separate pages._
5. **Sidebar groups:** Board / Site / Records / Account as in §4.2? _Default: yes._
6. **Trust this browser for 30 days** on the 2FA page (skips the code on that browser for 30 days)? Convenient, but a stolen laptop would then only need the passphrase. _Default: not offered._
