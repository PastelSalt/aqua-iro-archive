# Full update plan

Written 24 Oct 2026, revised the same day after a consistency pass. It replaces the step-by-step approach
in `VISUAL-REFINEMENT-PLAN.md`: the small borrowed ideas (§7 b, c, f, g) were built one at a time into
unchanged pages, and they look out of place. Part A redoes the site's visual language as one system,
applied to every page; Part B redoes the page-switch animation and the loading screen in the same language,
with the Moeko Works mark worked in. Ground rules still apply: official art shown as-is, Motion OFF stops
everything, smooth on the Ryzen 3 laptop.

## Why the mini update looks out of place

| Piece                   | What's wrong with it today                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navy contrast bands     | Hard rectangular edges on a site where every other section boundary is a soft wave seam. Only three pages have one, so the others feel unfinished by comparison. The white ghost number collides with the logo tab. |
| "Aqua says" states      | The pose is small and the bubble is a plain white pill; it shares nothing with the Talk dialogue box on Home, which is the site's real "Aqua speaks" component.                                                     |
| Sister-site cards       | A fourth card style. The maker card, the Prev/Next chapter cards and these cards each have their own radius, border and hover.                                                                                      |
| Credits / Privacy cards | Paper cards that exist only on those two pages; About and Events have the same kind of dense text without them.                                                                                                     |

The fix isn't to tweak these pieces; it's to make them part of a system that every page uses.

## The one idea everything follows

**The site is a harbour, and Aqua's colours are the sea.** Everything belongs to one of three layers:

- **The wash**: the pastel seigaiha ground, the shore you walk on.
- **Paper**: everything you read sits on paper (cards, tickets, notes, drawers), pinned or taped down.
- **The deep**: navy water with Aqua's pink-and-cyan glow on its crest. It appears once per page as a band,
  and it _is_ the page-switch and loading animation, so motion and layout use the same object.

Every rule below is a consequence of that idea. When something new is added, it picks one of the three
layers and follows that layer's rules.

---

## Part A — Full visual update

### A1. The system (build first)

Defined once in `tokens.css` and `components.css`, used everywhere.

**Colour roles**

| Role         | Colour                        | Used for                                                                                                                           |
| ------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Ink          | `--navy`                      | Text, icons, the deep.                                                                                                             |
| Aqua palette | `--aqua-pink` → `--aqua-cyan` | The site's signature: the crest of the deep, progress, active states, the splash.                                                  |
| Chapter tint | each chapter's `--tint`       | Only identifies a chapter: the dock's active pill, the banner card's tint bar, the eyecatch ticket's tape. Never a big background. |
| Paper        | `--paper`                     | Every reading surface.                                                                                                             |

This fixes a mismatch in the first draft, where the band was navy but the shutter was the chapter tint.
Now both are the deep (navy + aqua crest); the chapter tint only marks _which_ chapter.

**Surfaces**

- **Wash**: the pastel ground with the seigaiha pattern and the drifting motifs.
- **Paper**: white cards. No pattern, motifs or ghost numbers on top of paper, only tape and pins.
- **Deep band**: navy, with wave edges top and bottom from the existing `Seam` wave paths, so it rises out
  of the wash like the sea. An aqua pink-to-cyan glow along its top crest. Section titles on it use the
  normal title layout, only light. **Exactly one per chapter page**, on the page's headline block (table in
  A2). Reading pages (Credits, Privacy) have none.

**Shape and tilt**

- One radius scale (small: chips and buttons; medium: cards; large: bands, drawers and the splash).
- Tilt rule: paper you read (profile, credits, stream log, board composer) is straight. Small cards in a
  group (lore notes, records, clip cards, notes on the board) may tilt between −2° and +2°. Stickers,
  stamps and the eyecatch ticket may tilt up to ±12°. Nothing else tilts.

**Card family (two shapes)**

- **Banner card**: a row with an icon or logo, a title, a small line and a chapter-tint bar on the left.
  Used by the maker card, sister sites, Prev / Next chapter cards, and (large, tilted, taped) the
  page-switch ticket in Part B.
- **Content card**: a paper block for reading, with optional tape or pin. Used by lore notes, records,
  clip cards, credits sections, the profile card and board notes.

**"Aqua talks" (one component)**

The Home dialogue box is the template for every place Aqua speaks: its name plate (「あくあ AQUA」), frame and
type. The loading, empty and error states use a compact version of it with her pose beside it, and so does
the splash's TIPS box (B2). Lines are fan-written and follow `src/content/talk/README.md`.

**Type roles**

| Role                                                   | Font            |
| ------------------------------------------------------ | --------------- |
| Display (titles, numbers)                              | Fredoka         |
| Japanese UI and body                                   | Zen Maru Gothic |
| Vertical rails, emotional lines (ありがとう、あくたん) | Shippori Mincho |

These are the fonts the site already loads; the change is that every component follows the table. No new
fonts.

**Motion language**

- **Tide** (the only transition motion): things that change the screen rise and drain like water, with one
  shared easing and duration set (page switch, splash exit, drawers opening, in-page tab switches).
- **Float** (the only ambient motion): bubbles, motifs, bobbing poses and the slow pans of key visuals.
- Motion OFF removes both; layouts never depend on them (content is visible by default and only animates
  in, so a slow device still shows the page).

**Decoration rules**

Stickers, motifs and ghost numbers live on the wash only: title cards, seams, margins, and behind section
titles. Never over paper, never over official art's faces. This replaces the per-page `quiet` switch from
the mini update with one rule for every page. The Credits section numbers move outside their paper cards.

**What the system covers** (so nothing is left in its old style)

Dock, logo tab, Talk dialogue box, LOG / HELP drawers, BGM capsule, tour, Aqua Time tape deck and its
"On this day" toast, lightbox, buttons, chips, filter bars, tooltips, marquee and seams, side rails,
stamps and stickers, postcards, footer, splash, shutter, the 404 page. Drawers, toast and lightbox become
paper with a tide edge; the tape deck keeps its cassette look but in the new colour roles. Out of scope:
the keeper (admin) area, which stays plain on purpose, and a dark mode, which the site doesn't have.

### A2. Applied page by page

Every chapter page: title card → wave seam → wash sections → **one deep band** → wash sections → Prev /
Next → marquee → footer.

| Page              | Deep band                                             | Other changes (from the refinement plan)                                                                          |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Home              | Farewell (ありがとう、あくたん), as the night sea     | Hero rebalanced for 1366×649 (dialogue beside the title, not over her); phone hero shows her on the first screen. |
| About             | Personality & lore                                    | Outfit icon column beside the pose; profile card on paper, straight; wardrobe scrollbar styled.                   |
| Clips             | Top 3 clips as large content cards                    | Clips key art swapped for a face-led piece.                                                                       |
| Discography       | The 19 originals as a jacket shelf                    | Designed jackets for songs without official covers.                                                               |
| Streaming         | Records                                               | Records become a two-column compact grid on phones.                                                               |
| Events            | Brand & game collaborations                           | Year markers become chapter-tint chips on the voyage line; thumbnails on milestone and concert entries.           |
| Arts              | Featured key visuals strip                            | Section banners framed on faces.                                                                                  |
| Messages          | The board (composer and notes stay paper on the band) | Board states use "Aqua talks".                                                                                    |
| Credits / Privacy | none                                                  | Sections as content cards with an in-page index; section numbers outside the cards.                               |
| 404               | none (the page is already a small sea scene)          | Restyled to the new colour roles; "Aqua talks" for its line.                                                      |

### A3. How it ships

All of it lands together, so no page is half old, half new.

1. **Branch `full-update`.** The uncommitted mini-update work moves onto it as the starting point instead
   of going to `main` on its own.
2. **Screenshot tests first** (refinement plan §6): every chapter's first screen and its band at 1366×649
   and 375 px, Motion OFF. They record the "before" and catch regressions while the system changes.
3. **System (A1), then pages (A2)** in the order Home → About → Streaming → Discography → Events → Arts →
   Clips → Messages → Credits / Privacy → 404.
4. **Consistency check before merging:** walk every page at 1366×649, 1920×953 and 375 px against the A1
   tables (colour roles, one band per chapter page, two card shapes, tilt rule, decoration rule).
5. **Review on a Vercel preview URL** (pushing the branch builds one), then merge to `main` in one go.

Estimated 6–8 days for Part A.

**Progress (24 Oct 2026, branch `full-update`, not merged):**

- Done: guard rails (`cover.spec`, the local screenshot record), the system (the deep, banner and content
  cards, "Aqua talks", decoration and tilt rules, tokens), overlays (drawer tide edge, toast crest, deep
  lightbox), a deep band on every chapter page (Home farewell, About lore, Clips Top 3, Discography originals
  rack, Streaming records, Events collaborations, Arts featured prints, Messages board), designed covers,
  Arts banners on faces, the Clips art swap, records on phones, Home hero clear of the dock, outfit icons
  on About, Events thumbnails, the 404 line.
- Also done: the Credits / Privacy in-page index. The dock, logo tab, BGM capsule, tour and Aqua Time deck
  already use paper and navy, so they were reviewed and left as they are.
- Part B done (`e83d7c0`): the tide shutter, the three-beat loading screen with the VN title screen, and the
  Moeko Works flower marks. Checked in Chromium (e2e, including a new title-screen test) and by eye at
  1366×649 and 375 px; Motion ON animations were checked as forced frames.

---

## Part B — Page switch and loading screen

Both are **the deep in motion**: the navy sea with Aqua's pink-and-cyan crest rises over the screen and
drains away. The patterns are taken from established anime and game sites, each tied to something that is
specifically Aqua's.

| Established pattern                                 | Where it comes from           | Aqua's version                                                                                        |
| --------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Studio card before the opening                      | Anime OPs, anime sites' intro | 「制作 Moeko Works」 card                                                                             |
| Chibi "Now Loading"                                 | Uma Musume                    | Her `mmd-smile` pose hopping along the tide line                                                      |
| Loading TIPS                                        | Gacha and console games       | TIPS in the Talk box, in her voice                                                                    |
| Visual-novel title screen (はじめから / つづきから) | Galge and VN titles           | She loves galge and produced her own, _あくありうむ。_; this site already speaks in a VN dialogue box |
| Mid-episode eyecatch                                | Anime                         | The chapter ticket with her pose peeking over it                                                      |
| Copyright line at the bottom of a title screen      | Every game title screen       | 「© COVER Corp. · fan site by Moeko Works ✿」                                                         |

### B1. Page switch ("tide shutter")

Today: two flat diagonal triangles in the chapter tint, white title text, 180 ms in / 240 ms out; the first
visit to a chapter holds 600 ms on a pose.

New:

- **Close (≤ 220 ms):** two wave layers of the deep rise from the bottom edge, the front one carrying the
  aqua crest and the seigaiha texture at low opacity. Transform-only on pre-drawn SVG, so the cost stays
  the same as today's panels.
- **The ticket:** "No.06 / ARTS / アート" on a large banner card (A1), tilted, with washi tape in the
  chapter tint. That's the only place the chapter colour appears.
- **Eyecatch (first visit per chapter, ≤ 700 ms, skippable):** the chapter's official pose peeks over the
  ticket's edge and two or three bubbles rise.
- **Open (≤ 260 ms):** the waves drain up off the top, revealing the new page.
- **In-page switches** (Discography tabs, LOG drawer tabs, Streaming's list / calendar toggle): a small
  tide, a 2 px wave line sweeping under the tab strip with a 120 ms cross-fade. No full-screen shutter.
- **Motion OFF / reduced motion:** unchanged, an instant cut.

### B2. Loading screen ("出航準備" → title screen)

Today: a pale wash, "Setting sail…", a thin bar, a percentage and fine print. Rich instead, in three beats.

**Beat 1 — Studio card (≈ 600 ms).** A paper card on the wash: the Moeko Works logo, the two flowers
blooming in (scale and spin from the centre), and 「制作 Moeko Works / presented by Moeko Works」. Like the
production card before an anime opening.

**Beat 2 — Loading (until the page is ready, 1.0–2.6 s).**

- Behind everything, an official key visual fills the screen, softly blurred and slowly panning, the way
  anime sites always lead with the key visual.
- The deep rises from the bottom as progress: the sea level _is_ the progress bar. The percentage rides the
  water as an odometer (the site's own `Odometer`), and the marker on the waterline is the Moeko flower,
  slowly turning.
- Her `mmd-smile` pose hops along the tide line (Uma Musume's chibi loader); 「NOW LOADING」 in display type
  bobs letter by letter like buoys.
- A TIPS box in the Talk style, changing every ~1.2 s, with fan-written lines in her voice:
  「TIPS：あてぃしの初配信は2018年8月8日！」, 「TIPS：寄せ書きボードには、だれでも一枚貼れるよ」,
  「TIPS：下のTIMEボタンで、六年間のどの日にも行けるよ」. They teach the site while it loads.
- A petal from the flowers drifts in the water among the bubbles.

**Beat 3 — Title screen (first-ever visit only).** A visual-novel title screen, as in the galge she loves:

- The key visual comes into focus. The channel logo with 「AQUA IRO ARCHIVE / あくあ色アーカイブ」 sits large,
  with her pose beside it and a Talk bubble: 「こんあくあ〜！⚓」.
- A menu in VN style: **はじめから** (start, enters Home), **つづきから** (only when she's been here before:
  goes back to the last chapter visited), **あくあ時間** (opens Aqua Time), **設定** (Motion, JP/EN, and
  「BGMをつけて出航」, which starts the official-YouTube BGM from that click, so it is never autoplay).
- 「PRESS START / クリックで出航」 blinks under the menu; a click anywhere or Enter means はじめから.
- Bottom corners, like every game title screen: a version line, 「ver. 2018.08.08 – 2024.08.28」 (her
  active years), and the copyright line 「© COVER Corp. · fan site by Moeko Works ✿」.
- Leaving: the deep surges over the screen and drains away exactly like the page-switch shutter, so the
  first page arrives with the same motion as every later one.

**When it shows.** The full three beats on the first-ever visit. Later sessions: beat 2 only (1.6–3.2 s as
today), straight into the tide exit, no title screen. Skip (▸▸, Esc) always works. Replaying the tour from
HELP replays the full version.

**Motion OFF.** One still frame: the key visual, the logo, her pose, the title menu, the TIPS line and a
static sea level. No studio-card beat, no hopping, no blur pan.

**Accessibility.** The title screen is a modal dialog with focus on はじめから and a focus trap; the loading
beat keeps `role=status`; the menu works by keyboard.

### B3. Where the Moeko Works mark goes

A small SVG redraw of **the logo's two flowers only** (pink and purple, yellow centres, dark outline). The
wordmark always stays the original PNG.

| Where              | How                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Splash, beat 1     | The full logo, openly: 「制作 Moeko Works」.                                                |
| Splash, beat 2     | The progress marker on the waterline is the flower; one petal drifts in the sea.            |
| Title screen       | The copyright line, 「… · fan site by Moeko Works ✿」.                                      |
| Page-switch ticket | The corner seal is the flower pair, like a studio stamp on an eyecatch card.                |
| Eyecatch hold      | A tiny 「produced by Moeko Works ✿」 line at the bottom right.                              |
| Eyecatch bubbles   | Once per session, one of the rising bubbles is a flower.                                    |
| Footer             | Unchanged: the maker card and the sister-site banner cards (now in the shared card family). |

At most one per screen, never on official art, never larger than the chapter title.

### B4. Budget and checks

- The shutter stays within today's timings plus 40 ms, transform and opacity only. Checked with Motion
  ON on the Ryzen 3 laptop.
- The splash adds one inline SVG (the flowers, under 2 KB), a small blurred key visual (WebP, about 640 px
  wide, about 40 KB) and reuses the existing logos and pose through `getImage`. No new fonts. The title
  screen's script is loaded only on the first-ever visit; `npm run budget` must still pass.
- The existing e2e shutter and splash tests stay green and gain cases for the title screen (keyboard
  start, つづきから, Esc), plus one screenshot frame of each beat (forced state, Motion ON).

Estimated 3–4 days for Part B, after Part A (it reuses A1's deep, banner card and "Aqua talks").

---

## Decided (24 Oct 2026)

- **Flower mark:** a small SVG redraw of the logo's two flowers is OK; the wordmark stays the original PNG.
- **Splash studio card:** kept as an open card (beat 1).
- **Discography covers:** designed jackets for songs without official covers.
- **Mini update:** moves onto the `full-update` branch instead of going to `main` separately.
- **Direction for Part B:** lean on established anime and game site patterns, keeping Aqua's own things
  (the harbour and the sea, her galge love, her voice, her years) at the centre.
