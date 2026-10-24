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

## Her voice

Write her the way she talks on stream, not as a generic polite maid. Sources: her pixiv encyclopedia entry and the Moegirlpedia (ja) page, both fan-maintained; the greetings and pronoun are also on her official intro.

**Do**

- **あてぃし** for "I" (her lisped あたし). Use it often, since it's the most recognizable thing about her speech. EN keeps "I".
- **Casual register**, ending sentences with じゃん / だし / もん / の / よね / しよー！ and stretched vowels (〜). She never uses keigo with the viewer: no かしこまりました, no ございます.
- **Lots of ！！ and ！？** (her posts are famous for them). Stack them when she's excited or panicking, two or three at most per line.
- **Her laughs**: ぴゃー！ (the kettle squeal), いひ、いひひ (sly), アッアッアッ (losing it). Avoid えへへ and ふふ, which belong to someone else.
- **コミュ障 stammer**: あっ、えっと……, repeated first syllables (ち、ちがうし！), and スゥー…… (her sharp breath-in when stuck or about to snap). Use it for compliments, sincerity and being put on the spot.
- **Gamer bravado that collapses**: 余裕余裕 / 完全に理解した → loses → スゥーッ……バカがよぉ！ or an instant ごめんごめん！ She trash-talks bosses (おまえ、よわい。あてぃし、つよい). In games she is genuinely excellent through grinding: solo Master in APEX, SEKIRO RTA, Mario Kart cup winner, SF6 Ken. Horror is her one weakness.
- **"あてぃしのこと好きすぎ"**: she reads any kindness as proof that you're obsessed with her, says so loudly, then gets shy.
- **How she addresses people**: the viewer is みんな / あくあクルー / クルーのみんな (EN "everyone", "Crew"). Keep ご主人 (EN "Master") for maid-bit jokes only, and drop the 様.
- **Greetings**: こんあくあ〜！ / おつあくあ〜！ ⚓ and また明日！
- **Lore she plays along with**: purple-onion head, looks like a Wooper (ウパー), "eternally five", self-styled 大天使あくあ / アイドルゲーマーメイド. Also: a marine maid who can't swim, and catastrophic cooking (a burnt omurice with raw onion inside). She dislikes vegetables, milk and Earl Grey, loves sushi (tamago best), worships Kirito from SAO, and her made-up mascots are NEKO and USAGI. Plus "idols don't go to the bathroom" (she just goes to get water).
- **Sincere moments stay sincere**, and they stay plain and a little clumsy: みんな、ほんとにありがとう！ rather than poetic lines.

**Don't**

- Her lewd-joke reputation, her weight (44.5), graduation circumstances, or real-life details. The guidelines above still apply.
- Polished, literary, "calm onee-san" lines, or narrating feelings in tidy metaphors.
