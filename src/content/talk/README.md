# Talk with Aqua — writing guide

Scripts in this folder feed the dialogue box on Home. `npm run data` validates them (`scripts/validate-talk.ts`); the build fails on errors.

## Files

- `ask.yaml`, `tease.yaml`, `cheer.yaml`, `explore.yaml`, `special.yaml` — conversations (the category is a field, file names only group them).
- `idle.yaml` — short lines that appear on their own while the box is idle.
- `expressions.yaml` — expression → official pose (or a fallback emote sticker).

## Shape

```yaml
- id: favorite-game # kebab-case, unique
  title: { ja: '…', en: '…' } # shown in the Memory album
  category: ask # ask | tease | cheer | explore | special
  weight: 10 # relative; default 10
  rare: false # ~5% pool, ✦ in the album
  when: [any] # any | morning | day | evening | night | birthday | anniversary | graduation | first-visit | returning
  lines:
    - { exp: smile, ja: '…', en: '…' }
  choices: # 4–6 candidates; 3 are shown (≤ 1 goto, ≥ 1 non-goto)
    - id: fav
      ja: '…'
      en: '…'
      reply:
        - { exp: excited, ja: '…', en: '…' }
      next: rematch # optional: a node in this conversation
      goto: streaming # optional: offers "Take me there →" after the reply (never auto-navigates)
  nodes:
    rematch:
      lines: [{ exp: pout, ja: '…', en: '…' }]
      choices: [] # empty = the conversation ends
```

Quote every `ja` / `en` value with double quotes (commas inside flow maps otherwise split the value).

## Writing guidelines (from the concept, §6.5.7)

- The box and the LOG drawer say: **"Lines are fan-written for this archive, not her actual words."** Keep the site clearly unofficial.
- In character and lighthearted: games, songs, maid duties, her cat, fan memes, gratitude to the Aqua Crew.
- Teasing stays affectionate. She is never mocked for real insecurities, and she can "win" the exchange.
- **Avoid:** her real-life person, the reasons for her graduation, rumors and drama, romance or anything suggestive, putting opinions about other talents in her mouth, and inventing "new" announcements or plans.
- Short lines: about 40 Japanese characters or 80–90 English per box.
- Bilingual: every line has `ja` and `en`; the JP/EN toggle picks which one shows.
- `scripts/talk-watchlist.txt` lists words worth a second read; the validator warns, it doesn't block.
