# Improvement plan: a full, moving, one-of-a-kind archive

Written 13 Oct 2026, after the audit fixes (`be23987`). Two parts:

1. **Fill every area, animate everything you can see:** the design rules anime sites use, applied
   page by page.
2. **Make it unique:** a proposal for features no other fan archive has.

Ground rules that stay in force:

- **Official art is shown as-is.** It can be cropped, framed, layered or moved, but never redrawn,
  recoloured or edited into new faces (the Credits policy).
- **No audio is hosted.** Music only comes from official YouTube embeds.
- **AUTO (Motion OFF) stops all of it.** Every animation below has a still version.
- **It must stay smooth on the slow laptop** (Ryzen 3 3250U, 1366×768). There's a performance budget
  in §1.4.

---

## Part 1: Anime-site design language

### 1.1 What anime official sites do, and what we take from them

Official anime sites (seasonal series, idol projects, game tie-ins) share a handful of habits. These
are the ones this plan adopts:

| Habit                            | What it means here                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Key visual first, full bleed** | Each chapter opens on one big official artwork that fills the screen behind the title, not a small picture beside it.             |
| **Layers, never flat**           | Background wash → pattern → art → stickers/doodles → type. Each layer moves at its own speed (parallax).                          |
| **No dead margins**              | The space left and right of the content holds something: vertical type, a running number, a filmstrip, a ticker, floating motifs. |
| **Constant gentle motion**       | Something is always moving: a marquee, bubbles, a slowly panning visual, a blinking cursor. The page never looks frozen.          |
| **Every transition is an event** | Changing chapter is a scene change (wipe, iris, shutter), not a page reload.                                                      |
| **Numbers as decoration**        | Chapter numbers, dates and counts set huge and faint behind content ("No.04", "639", "2018→2024").                                |
| **Stickers and stamps**          | Rotated badges, tape, speech bubbles and stamps break the grid and fill corners.                                                  |
| **Section dividers are visuals** | Between sections: a ticker, a wave, a rope, a filmstrip, never just blank space.                                                  |

### 1.2 The "no empty area" rule, made measurable

"No empty area" is turned into a test, so it can't drift:

- **The check:** take a screenshot of each screen and split it into 120×120 px cells. A cell counts
  as **empty** when its pixels hardly vary (standard deviation below ~6 on the background wash).
- **The target:** at most **8% empty cells** per screen, on every page, at 1366×649, 1920×953 and
  390×664, scrolled top to bottom.
- **How it runs:** as an e2e test (`tests/e2e/fill.spec.ts`), next to `layout.spec.ts`. It also
  writes a heat-map image of the empty cells, so it's obvious where to add something.

Today the biggest empty zones are:

- the new full-screen chapter title cards at 1080p (the top-left and bottom-right of the card);
- the left and right margins outside the 1200 px content column at 1920 wide;
- the space between sections (≈ 96–160 px bands);
- the end of masonry columns (Arts, Clips, Messages);
- the text-only pages (Credits, Privacy, 404) at 1920.

### 1.3 Site-wide fillers (one set of parts, reused everywhere)

Every empty zone above is filled by one of these. Build them once, place them per page.

| Part                   | What it is                                                                                                                                                                                           | Where                        | Motion                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Side rails**         | At ≥ 1440 px, the margins outside the content column carry a vertical filmstrip of small art frames from the current chapter (left) and the chapter's vertical JP title + a running counter (right). | All chapter pages            | The filmstrip drifts slowly upward (60 s per loop) and its scroll speed follows yours, at half the rate. |
| **Ghost numbers**      | Huge outlined chapter numbers / years / counts (`04`, `639`, `2020`) behind sections, 6% opacity.                                                                                                    | Every section                | Parallax at 0.6× scroll; they rise into place as the section enters.                                     |
| **Section seams**      | Every gap between sections becomes a seam: a tilted ticker (like the existing marquee), a wave band, or a rope with buoys. Three kinds rotate so pages don't repeat.                                 | Between all sections         | Ticker scrolls; waves undulate; buoys bob.                                                               |
| **Motif field**        | Anchors, bubbles, stars, hearts and ribbons as a light background layer (one canvas, as on Home), with density that rises in bigger empty areas.                                                     | Whole site                   | Float and drift; bubbles pop on cursor contact (as on Home now).                                         |
| **Sticker kit**        | Rotated tape strips, "NEW", "TOP 30", stamps and speech bubbles quoting her catchphrases (fan-written lines, labelled as such).                                                                      | Corners of cards and visuals | Slight sway; they "stick on" with a squash when they enter.                                              |
| **Masonry tails**      | When a masonry column ends early, the gap is filled with a "postcard": a quote, a fact, a mini chart or a doodle, sized to fit the gap.                                                              | Arts, Clips, Messages        | Fades and settles in.                                                                                    |
| **Ambient key visual** | Behind each title card, the chapter's key visual full-bleed, softly blurred and tinted, with the sharp artwork in front.                                                                             | Chapter title cards          | Slow Ken-Burns pan/zoom (20 s), parallax on mouse move (≤ 12 px).                                        |

### 1.4 Animation system and performance budget

There are four kinds of animation, each with its own rules:

1. **Ambient loops** (always running while on screen): marquee, bubbles, floats, pans, cursor
   blink.
   - Only `transform` and `opacity`, on their own layers.
   - At most **12 active loops on screen**.
   - Paused off screen (the existing `offscreen.ts`).
2. **Entrances** (once per element per page view): title-card intro, section reveals, sticker
   stick-ons.
   - At most 700 ms, staggered by at most 240 ms per group.
   - They play when the element arrives (the existing `reveal.ts`).
3. **Scroll-driven**: parallax, ghost numbers, the Events rope, progress bars, filmstrip speed.
   - Uses CSS scroll-driven animations (`animation-timeline: view()`/`scroll()`) where the browser
     supports them, so they run off the main thread; GSAP ScrollTrigger where it doesn't.
   - Never more than one scroll listener for chrome (the plan's `chrome-scroll` module).
4. **Interaction**: hover tilt, press squash, sparkles, card flips, dock changes.
   - Under 300 ms, and they react on the same frame as the input.

**Budget on the Ryzen 3 at 1366×649:**

- scrolling holds **≥ 55 fps** on every page;
- idle main thread stays **< 15% busy**;
- each page adds at most **≤ 40 KB of JS**;
- the motif canvas runs at ≤ 30 fps and draws ≤ 40 sprites.

`scripts/dev/perf.mjs` already measures this; it becomes a CI check with these numbers.

**Motion OFF:** loops stop, entrances show the final state, parallax stays still and page changes cut
straight across. Users with reduced-motion set get Motion OFF by default (already the case).

### 1.5 Page by page

#### Global chrome

- **Chapter change:** replace the iris with a **shutter wipe** in the destination chapter's colour.
  Two diagonal panels close (180 ms) over the chapter number in big type ("No.04 STREAM"), then
  open (240 ms) on the new page, like an anime's eyecatch.
- **Eyecatch on first visit to each chapter:** the first time a chapter opens this session, the
  shutter holds for 600 ms on a small official pose with the chapter name, like the cards shown
  between an anime's halves. It's skippable, and later visits use the quick shutter.
- **Logo tab:** the anchor in the logo swings gently on scroll (it rotates with scroll velocity and
  springs back).
- **Dock:** the current chapter's dot leaves a trail of three bubbles when you change chapter, and
  the dock's top edge gets a thin progress line showing how far down the page you are.
- **Footer:** a full-width "ending card": a wave band, the signature art, a slow marquee of
  thank-you lines, and the Moeko Works card. The page always ends on a visual.

#### Home (No.00)

Home is already the fullest page. What it still needs:

- **Hero:** add a thin, rotating ring of tiny art frames around the circle (a "carousel halo"), so the
  area between the circle and the side columns isn't bare at 1080p.
- **Three Moments:** each card's thumbnail plays a short looping YouTube preview frame-strip on
  hover. This uses the official thumbnails only, flipping through `hqdefault` / `1` / `2` / `3`.
- **Chapter spread:** the cards fan out from a deck as they enter, with a flip, and each card
  gently "breathes" (scale 1→1.01) while idle.
- **Farewell section:** the signature draws itself (a stroke reveal on the signature image's mask),
  then the anchor stamp spins in.

#### About (No.01)

- **Title card:** the full-bleed key visual is her 3D model pose in front of a slow-panning blurred
  version of the same art.
- **Profile card:** it flips in like a trading card. Hovering the photo cycles through the four
  portraits (`portrait-01/03/04/06`).
- **Personality notes:** the sticky notes are pinned with tape that peels a little on hover; empty
  spots in the grid get doodle notes (her onion, mop, cat).
- **Relationship map:** connections draw as animated dashed lines; nodes orbit their group slowly;
  clicking a node zooms the map to it.
- **Model history:** a horizontal filmstrip that scrolls itself slowly (pauses on hover), and its
  frames tilt toward the cursor.

#### Clips (No.02)

- **Masonry tails:** quotes from the clip titles fill the gaps at column ends.
- **Rank badges** count up as cards enter (#1 → #30).
- **View counts** tick up from 0 to their value on arrival.
- **Hover:** the thumbnail zooms slightly and a "▶ play" sticker bounces in.

#### Discography (No.03)

- **Vinyl:** the record spins while a song is playing in the BGM capsule, and stops otherwise.
- **Jackets:** they slide out of the vinyl sleeve as they enter. Hover tilts the jacket in 3D (±8°)
  with a glare highlight.
- **Timeline view:** years are tracks on a big turntable arm sweep; the needle follows your scroll
  position.
- **Empty grid slots** at the end of each list hold "B-side" cards: a lyric-free fact or credit line.

#### Streaming (No.04)

- **Year chart:** bars grow from 0 on arrival, and the 2020 peak gets a crown sticker that drops in.
- **Heatmap calendar:** cells fill in day by day, like a week ticking past, the first time it's shown.
- **Stream list:** a faint ghost year (`2021`) behind the list changes as you scroll through years.
- **Counter rail:** a fixed side counter shows "hours watched so far if you'd watched every stream up
  to this row", rising as you scroll (data from `streams.json` durations).

#### Events (No.05)

- **Rope:** it already fills on scroll. Add a small ship that sails down the rope at your scroll
  position, and port flags that unfurl as each year arrives.
- **Event cards:** they swing in from the rope side like hanging signs.
- **Graduation (end):** the lighthouse beam sweeps across the whole width, and the page dims slightly
  as it passes.

#### Arts (No.06)

- **Gallery sections:** each section opens with a full-width art banner (one piece from the section,
  slow pan) instead of a plain heading.
- **Tiles:** they "develop" like photos on arrival (blur → sharp over 400 ms), and hover lifts them
  with a soft shadow.
- **Lightbox:** add a filmstrip of the section's other pieces along the bottom, and a slow Ken-Burns
  on the open piece when it isn't zoomed.

#### Messages (No.07)

- **Board:** notes float in like paper settling (swing + drop), and a pinned note bounces once.
- **Empty board** (or while paused): a sleepy-cat scene: animated Zzz, a wobbling lantern, and
  drifting bubbles instead of a plain card.

#### Credits / Privacy / 404

- **Credits and Privacy:** at 1920 wide, side rails show the artist names as a slow vertical credits
  roll (fitting the page), plus faint ghost headings.
- **404 "Lost at sea":** a full ocean scene: waves loop, a little boat bobs, and bubbles rise. The
  "Back to the archive" button is a buoy you can grab and throw.

---

## Part 2: Making it unique, a surprise proposal

Most fan archives are lists with pictures. This one already has a visual-novel dialogue, a dock that
types like a name plate, and a crew-numbered message board. The proposal pushes it into "this could
only exist for Aqua". There are five ideas; **A is the headline**, and B–E support it.

### A. 「あくあ時間」 — Aqua Time: travel to any day of her six years ★ headline

**The idea:** a time machine for the whole site. A tape-deck scrubber (a VHS-style counter with
「2018.08.08 → 2024.08.28」) lives in the dock. Drag it to any date, or press **今日 / On this day**,
and the archive becomes that day.

**What changes when you pick a date:**

- **Home hero:** shows the outfit she was wearing then. The data is already there: outfit dates in
  `arts.yaml`, chosen from the official poses.
- **Talk:** Aqua's greeting is about that day. It uses fan-written lines picked by context: "it's
  her 3rd anniversary today", "she just hit 1M subscribers this week" (from `events/timeline.yaml`).
- **Streaming:** jumps to that week and highlights the streams around it.
- **Discography:** marks the newest song she had released by then; later songs show as 「まだ」
  ("not yet").
- **Counters everywhere:** "day 1,096 of 2,213 · 318 streams so far · 1.2M crew".
- **Palette:** the site's tint shifts slightly with the season of the date picked (spring pink,
  summer cyan, autumn lavender, winter navy), by changing the colour tokens, never the art.

**On this day:** opening the site on any calendar day shows a small toast:
**「2年前の今日」 Two years ago today** — what happened on that month/day in past years (a stream, a
song, an event, an art piece). Every visit has a reason to come back.

**Why it's unique:** it turns a static archive into something you _visit_ — "what was Aqua doing on
my birthday in 2020?" All the data already exists (`streams.json` has 639 dated entries, the timeline
has 60, arts have dates). Nothing is invented; it's the archive re-indexed by time.

**Motion:** dragging the scrubber plays a fast "rewind" effect, with scan lines, a slight
chromatic-shift overlay on the chrome only (never the art), and the counter digits rolling. Letting
go snaps with a tape-click shake.

**Effort:** a medium-large feature, about one week:

- a date index built at build time from the existing data, about 40 KB JSON, loaded only when the
  scrubber opens;
- one store for the chosen date;
- each page reads it.

### B. 「エンディング」 — The Ending: a real anime ED roll

**The idea:** at the very bottom of the site (and from a button in HELP), **▶ Play the ending**
starts a full-screen, anime-style ending sequence:

- **Credits:** a slow credits crawl of everything in the archive. All 639 stream titles stream by
  in small type, then the clippers, the artists, the songs, and finally **every crew number from
  the message board** ("and you, crew #0042").
- **Art:** behind it, the official key visuals cross-fade with slow pans.
- **Music:** optional official music through the existing YouTube BGM (e.g. 「#あくあ色ぱれっと」),
  and only if the visitor presses play.
- **End card:** 「ありがとう、あくたん」 with the signature, and 「See you ⚓ またね」.

**Why it's unique:** she graduated, and this is a tribute archive. An ending sequence is the most
anime way to say goodbye, and including the visitor's own crew number makes it personal. It needs
no new content, only the data the site already has.

**Effort:** small-medium, 2–3 days. It's one route-less overlay plus a timeline.

### C. 「あくあガチャ」 — Capsule machine for the art gallery

**The idea:** a capsule-toy machine sits in the Arts page's empty first-screen corner. Turn the
handle (click or drag in a circle) and a capsule drops, wobbles, and pops open to show one random
official art piece, with its credit. Pieces you've drawn go into the existing **memory album** in
LOG (now with an art page: "47 / 190 collected").

- **Rarity:** comes from the art's section. Concept sheets and 3D are the rarest, and anniversary
  art gets a shimmer frame.
- **No duplicates until the set is complete, then it resets.**
- **Nothing is sold or locked:** every piece stays freely visible in the gallery. The gacha is just
  a playful way to meet them one by one.

**Why it's unique:** it turns 190 pieces from a wall into a game, and it fits her gamer side. It
also gives the Arts first screen real content.

**Effort:** small, 2 days. It's CSS/SVG capsule art plus GSAP physics-lite.

### D. 「記念日モード」 — Anniversary takeovers

**The idea:** on her real dates the whole site dresses up automatically, like an anime site's
campaign takeover:

| Date                               | Takeover                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **8 Aug** (debut)                  | Party mode: confetti anchors on load, the hero swaps to the debut outfit, and the Talk opens with a debut-day line.                 |
| **1 Dec** (birthday)               | Birthday mode: a cake sticker on the logo, a birthday key visual, and a "write a birthday note" banner on Messages.                 |
| **28 Aug** (graduation)            | Lighthouse mode: the whole site turns to dusk tones, the ending (B) is offered on arrival, and the dock plate reads 「ありがとう」. |
| **Each year-ending date** (Dec 31) | A "year in streams" recap card for that year in the archive.                                                                        |

It runs entirely from the date (in JST), with no server, and visitors can switch it off in HELP.

**Effort:** small, 1–2 days, once A's date index exists.

### E. 「マリンメイドの船内放送」 — Ship's announcements

**The idea:** a little speaker icon in the logo tab occasionally (at most once per visit, never
while reading) shows a ship-PA style speech bubble — fan-written, labelled as such — reacting to what
you're doing:

- you've been on Streaming a while: "Crew, please stay hydrated ⚓";
- you open the 2020 stream list: "2020 was her busiest year — 197 streams!";
- you find a rare Talk branch: "A rare conversation was found!".

**Why it's unique:** it gives the archive a voice between pages, in the same visual-novel spirit as
Talk, without autoplaying anything or covering content.

**Effort:** small, 1 day. It's a rule table over existing events (page, time, scroll, Talk state).

---

## Roadmap

| Phase               | Work                                                                                                                                                                              | Time       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **1 · Foundations** | The empty-area test (§1.2) and perf budget in CI; filler parts (§1.3: side rails, ghost numbers, section seams, motif field, sticker kit, masonry tails); the shutter page change | ~1 week    |
| **2 · Pages**       | §1.5 page by page, in the order Home → Arts → Discography → Streaming → Events → About → Clips → Messages → Credits/Privacy/404                                                   | ~1.5 weeks |
| **3 · Unique**      | A (Aqua Time) only — B–E on hold                                                                                                                                                  | ~1 week    |
| **4 · Polish**      | Motion OFF pass, reduced-motion pass, phone pass, the perf budget on the Ryzen 3, a full visual re-audit at 1366 / 1080p / phone                                                  | ~3 days    |

Each step ships on its own and is checked at 1366×649, 1920×953 and a phone. A step is only finished
when it passes the empty-area test, the perf budget and the existing layout tests.

## Decisions (14 Oct 2026)

- **Part 1: approved in full.** That includes the shutter wipe with first-visit eyecatch (§1.5
  Global) and the art filmstrip side rails at ≥ 1440 px (§1.3).
- **Part 2: only A (Aqua Time) is approved.** B, C, D and E are on hold and are not built.
- **Fan-written lines** for Aqua Time's date greetings are fine, labelled as fan-written like the
  rest of Talk.
