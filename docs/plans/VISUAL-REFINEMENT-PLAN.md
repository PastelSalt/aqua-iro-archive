# Visual refinement plan

> **Superseded by `FULL-UPDATE-PLAN.md` (24 Oct 2026).** The findings below still stand; the full
> update plan folds them into one site-wide pass instead of small steps.

Written 24 Oct 2026, after a page-by-page pass over the site at 1366×649 (the slow laptop), 1440 / 1920
wide and 375 px phone, with Motion OFF so layout could be judged without animation timing. This is a
polish pass on what exists: no new features. The ground rules from `IMPROVEMENT-PLAN.md` still apply
(official art shown as-is, AUTO stops all motion, stay smooth on the Ryzen 3).

Already fixed this week, for context: the Chapter Select cards and every chapter's title-card backdrop
now frame her face instead of her chest or legs (`1215eaf`), and the keeper pages no longer render blank
under the page wash (`fe0a04d`).

---

## 1. Art framing — finish the job (High)

Cropped art is the thing visitors noticed first. Two spots still crop the same way the cards did:

| Where                          | What's wrong                                                                                                                                               | Fix                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Arts: section banners**      | Each banner is the section's first artwork at `object-position: 50% 30%` (`fill.css`). For full-body outfit art, 30% is her collar and chest.              | Give each section a banner focus (faces sit at ~10–15% on full-body art), or pick a dedicated wide key visual per section as the banner. |
| **Clips: card and header art** | `anniv-2020-birthday-gaou` is framed on her face now, but the composition is mostly crossed legs and a garter, so it still reads oddly as a chapter image. | Swap Clips to a different official piece (a key visual or an anniversary piece with her face as the subject).                            |

**Make it stick:** every place that crops art now has a focus setting (`cardFocus` on Home,
`focus` in `chapter-art.ts`). Add the same for the Arts banners, then one rule next to the "art is
shown as-is" note at the top of `chapter-art.ts`: any crop of official art sets a focus on her face. That
keeps the next new crop from reintroducing it.

## 2. First screen at 1366×649 (High)

The slow laptop is the main target, and its first screen is the tightest:

- **Home:** the dialogue box overlaps the hero circle and covers her from the waist down, and the
  dock covers the dialogue's "Lines are fan-written" note. On short screens (height < 700 px), shrink
  the circle and move the dialogue up beside the title column, or let the circle sit above the dialogue
  instead of under it.
- **Chapter pages:** the title cards are fine. The dock floats over the first rows of content
  (e.g. the About profile card) because nothing below the dock is reserved. Add bottom padding equal to
  the dock's height to the last section of each page, so the last row is never stuck under it.
- **Phone Home:** the hero circle starts below the fold, so the first screen is all text. Put a compact
  version of the circle (or her pose) next to the title on phones, so the first thing you see is her.

## 3. Missing artwork and empty states (Medium)

- **Discography:** songs without a jacket (For The Win, ヨーコソ! Sweet Carnival!, カシオペア) show a
  flat colour tile with the title and ♪, next to real covers. Either use the song's official MV
  thumbnail (i.ytimg.com is already allowed in the CSP) or design a proper typographic jacket: the
  song's colour, title set large, the anchor mark, so they look intentional.
- **Message board error:** when notes can't load it shows a bare "Couldn't load the notes." and a
  button inside an empty card. Give it the same treatment as "The board is resting today": a small
  sticker, an in-voice line, and the retry button.

## 4. Long pages that drag (Medium)

- **Events timeline:** dozens of near-identical text cards, alternating left and right, with a lot of
  empty space between them. Add a thumbnail on milestone and concert entries, compress plain entries
  into one line, and make each year a clear chapter break (the year marker is already there, it just
  needs more weight).
- **Streaming records on phone:** 12 tall cards in one column. Use a two-column compact grid, or a
  horizontal swipe row like the wardrobe.
- **Credits & Policy:** a wall of headed paragraphs. Split it into cards with an in-page index, like the
  About sections.

## 5. Small inconsistencies (Low)

- **About wardrobe scroller** shows the browser's grey scrollbar. Style it to match (thin, tinted) or
  hide it and rely on the arrows / drag.
- **Prev / Next chapter cards** at the bottom of each page: a pink circle decoration overlaps the
  card's corner and part of its label (seen on About and Messages). Move it outside the card or behind
  it.

## 6. Guard rails (Medium — prevents repeats)

Two of this week's problems (the blank keeper pages, the crops) were visible bugs that no test caught.

- **Keeper smoke test:** an e2e test that loads `/keeper/login` and checks the form is the topmost
  element at its centre (`elementFromPoint`), so a background layer can't cover it again.
- **Screenshot tests for the first screen:** Playwright `toHaveScreenshot` of each chapter's first
  screen at 1366×649 and 375 px, Motion OFF. Any change to crops, overlap or layout then shows up as a
  diff in CI instead of in production.
- **Content never waits on animation:** entrances should only animate content that is already visible
  by default, so if scripts are slow or blocked the page still shows. Worth checking on the Ryzen
  laptop with Motion ON; in a throttled browser some sections stayed invisible for several seconds.

## 7. Borrowed from other sites (Medium)

A look at seven official sites in the same world (24 Oct 2026, at 1366×768): the anime sites for
_Bocchi the Rock!_, _Oshi no Ko_ and _Frieren_, the idol game sites for _Gakuen iDOLM@STER_ and _Uma
Musume_, and hololive's own talent page for Aqua. This site already does much of what they do (a key
visual first, faint giant numbers, vertical type, a per-chapter tint, three featured videos). These are the
parts it doesn't do yet that fit it, ranked by how much they'd help.

| #   | Seen on                          | What they do                                                                                                                                              | Adapted here                                                                                                                                                                                                                                                                                                                        | Size        |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| a   | hololive talent page             | A column of round outfit icons beside the big full-body render; clicking one swaps the render.                                                            | **About hero:** the same icon column next to the pose, using the official outfit poses already in `src/assets/poses`. Home's 「OUTFIT ランダム」 dropdown could become the same icons. It matches how her official page presents her, and the art stays as-is.                                                                      | ~1 day      |
| b   | Uma Musume                       | A small chibi of a character runs above 「Now Loading…」 while the page loads.                                                                            | **Loading, empty and error states:** a small official Aqua pose (e.g. `mmd-smile`) with an in-voice line: board loading, 「Couldn't load the notes」, empty search results, the lightbox while art loads. This also covers §3's board error state.                                                                                  | ~half a day |
| c   | _Oshi no Ko_, hololive           | One section per page sits on a bold, saturated patterned panel (hot pink with sparkles; green diagonal stripes), which breaks up an otherwise light page. | **One contrast band per page:** the site is pastel from top to bottom, so nothing stands out. Give each page one navy or deep-tint band with the anchor or seigaiha pattern, for its headline block: the Streaming records, the Discography "now playing", the Events year markers. Text contrast is checked by `npm run contrast`. | ~half a day |
| d   | _Bocchi the Rock!_               | On wide screens, the key visual is pinned in the left half while news and video scroll on the right.                                                      | **Pinned art column on wide screens (≥ 1440 px):** on About, Events and Credits, the chapter's pose stays pinned at the side while the long content scrolls past, instead of disappearing after the title card. This uses the side space the filmstrip rails fill today on those pages only.                                        | ~1 day      |
| e   | _Bocchi the Rock!_               | The announcement opens as a tilted photo print on a dark backdrop.                                                                                        | **"On this day" as a photo print:** the Aqua Time toast becomes a small tilted print card with that day's thumbnail or art, so the reason to come back looks like a keepsake rather than a notification.                                                                                                                            | ~half a day |
| f   | _Frieren_                        | The scene art carries the page; the only chrome is one MENU button.                                                                                       | **Quieter text-heavy sections:** fewer floating stickers and motifs over the About profile card, the Credits text and the stream log, so the dense parts read cleanly. Decorations stay on the title cards and section seams.                                                                                                       | ~2 hours    |
| g   | _Oshi no Ko_, _Bocchi the Rock!_ | Related sites are image banners (sidebar or footer), not text links.                                                                                      | **Sister sites as banner cards** in the footer (Kotoha, Hanon, Moeko Works), each with its logo, like the Moeko Works maker card already there.                                                                                                                                                                                     | ~1 hour     |

**Built (24 Oct 2026): b, c, f, g.**

- **b:** `ui/AquaWait.astro` (and the same markup in `BoardApp.tsx` and `lightbox.ts`). The pose comes from
  `--pose-wait`, which `Base.astro` sets on `body`. It covers the Streaming and Discography no-match
  states, the board's first load and failure, and the lightbox while a piece loads.
- **c:** `.band` in `fill.css`. It's on About's Personality & lore, Streaming's Records and Events' Brand
  collaborations. Discography and Clips have no section below the title card that suits it, so they don't
  get one. `npm run contrast` checks the new pink-wash-on-navy pair.
- **f:** Credits and Privacy pass `quiet` to `Base` (via `Extra.astro`), which hides the motifs over the
  reading column and puts each section on a paper card. The ghost year over the stream log is fainter
  (0.28 → 0.14).
- **g:** `SISTER_SITES` in `lib/site.ts` carries each site's emoji mark and theme colour, taken from the
  site's own title and `theme-color`. There are no logo files for Kotoha and Hanon, so the cards use the
  mark instead.

**Not borrowed:** full-screen loading screens on every visit (this site already has a once-per-session
splash), cookie banners (it has no cookies to ask about), and autoplaying carousels (they fight Motion OFF
and the slow-laptop budget).

---

## Order of work

| Step | Work                                                                           | Size        |
| ---- | ------------------------------------------------------------------------------ | ----------- |
| 1    | §1 art framing (Arts banners, Clips art swap)                                  | ~half a day |
| 2    | §6 keeper smoke test + first-screen screenshot tests                           | ~half a day |
| 3    | §2 first screen at 1366×649 and phone Home                                     | ~1 day      |
| 4    | §3 discography jackets, board error state                                      | ~1 day      |
| 5    | §4 Events, Streaming records on phone, Credits                                 | ~1–2 days   |
| 6    | §5 small fixes                                                                 | ~2 hours    |
| 7    | §7 b, c, f, g (loading states, contrast bands, quiet sections, sister banners) | done        |
| 8    | §7 a, d, e (outfit icons, pinned art column, photo-print toast)                | ~2–3 days   |

Screenshot tests go in early (step 2), so every later step is checked against them. Each step is checked
at 1366×649, 1920×953 and a phone, like the improvement plan's steps.

## Decisions needed

- **Discography covers:** official MV thumbnails, or designed typographic jackets?
- **Clips art:** which piece replaces the birthday art? (I'd suggest a key visual with her face as the
  subject; a short list can come with step 1.)
- **Borrowed ideas (§7):** which of a–g to build. Step 7 groups the small, low-risk ones; step 8 the
  ones that change a page's layout.
