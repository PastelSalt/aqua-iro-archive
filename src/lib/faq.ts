/**
 * Home FAQ: the questions people (and AI search tools) actually ask about Minato Aqua's archive, answered in
 * both languages with a link to the chapter that holds the answer. The questions follow the prompts tracked in
 * OpenSEO's AI visibility report (2026-11-09). One source for the visible list and the FAQPage JSON-LD.
 * Keep the numbers in step with the chapters they quote (streaming, discography, clips, arts).
 */
export type FaqItem = {
  id: string;
  q: { ja: string; en: string };
  a: { ja: string; en: string };
  href: string;
  link: { ja: string; en: string };
};

export const FAQ: FaqItem[] = [
  {
    id: 'what',
    q: { ja: 'Aqua Iro Archive（あくあ色アーカイブ）とは？', en: 'What is Aqua Iro Archive?' },
    a: {
      ja: 'ホロライブ2期生・湊あくあさんの6年間（2018–2024）を、プロフィール・切り抜き・歌・配信・イベント・アート・寄せ書きの7つの章で残した、日本語と英語の非公式・非営利ファンアーカイブです。Moeko Works の Kyle Zoleta が制作しました。COVER株式会社・ホロライブプロダクションとは関係ありません。',
      en: "An unofficial, non-profit, bilingual (JA/EN) fan archive of hololive 2nd Generation's Minato Aqua and her six years (2018–2024), in seven chapters: profile, clips, songs, streams, events, art and a message board. Made by Kyle Zoleta of Moeko Works; not affiliated with COVER Corp. or hololive production.",
    },
    href: '/credits',
    link: { ja: 'クレジットとポリシー', en: 'Credits & policy' },
  },
  {
    id: 'all-streams',
    q: {
      ja: '湊あくあの全配信を整理しているアーカイブはありますか？',
      en: "Is there an archive of all of Minato Aqua's streams?",
    },
    a: {
      ja: '配信アーカイブの章に、YouTubeに残っている配信639回（約2,013時間）を一覧にしています。2018〜2019年の配信の多くは非公開・削除されているため、その年は少なめです。',
      en: 'The Streaming chapter lists all 639 stream archives still public on her channel, about 2,013 hours. Most 2018–2019 streams were privated or deleted, so those years are undercounted.',
    },
    href: '/streaming',
    link: { ja: '配信アーカイブを見る', en: 'Open the stream archive' },
  },
  {
    id: 'by-date',
    q: {
      ja: '湊あくあの配信アーカイブを日付から探すには？',
      en: "How can I find Minato Aqua's streams by date?",
    },
    a: {
      ja: '配信アーカイブの章で、年・タグ・タイトルのキーワードで絞り込み、古い順・新しい順・長さ・再生数で並べ替えられます。下のドックの TIME（あくあ時間）を使うと、デビューから卒業までの好きな日へ移動して、その日の配信や歌を見られます。',
      en: 'In the Streaming chapter, filter by year, tag or a word from the title, and sort by oldest, newest, length or views. The TIME button in the dock (Aqua Time) takes the whole archive to any day from her debut to her graduation, with that day’s streams and songs.',
    },
    href: '/streaming',
    link: { ja: '日付から探す', en: 'Search by date' },
  },
  {
    id: 'history',
    q: {
      ja: '湊あくあのデビューから卒業までの歩みを振り返るには？',
      en: "Where can I look back on Minato Aqua's career, from debut to graduation?",
    },
    a: {
      ja: 'イベントの章が、2018年のオーディションから2024年の卒業ライブ「あくあ色に染まれ！」までを年表でたどります。配信アーカイブの章では、年ごとの配信数も見られます。',
      en: 'The Events chapter is a timeline from the 2018 casting call to her 2024 graduation live. The Streaming chapter also shows how many streams she did each year.',
    },
    href: '/events',
    link: { ja: 'イベントの年表を見る', en: 'Open the timeline' },
  },
  {
    id: 'songs',
    q: {
      ja: '湊あくあのオリジナル曲や歌ってみたを一覧で確認できますか？',
      en: "Is there a list of Minato Aqua's original songs and covers?",
    },
    a: {
      ja: 'ディスコグラフィの章に、ソロのオリジナル19曲とソロEP、ユニットやグループで約30曲、歌ってみた47本（ソロ21・コラボ26）をまとめています。2019年2月から2024年9月までの歌声です。',
      en: 'The Discography chapter lists her 19 solo originals and a solo EP, about 30 unit and group songs, and 47 covers (21 solo, 26 collab), from February 2019 to September 2024.',
    },
    href: '/discography',
    link: { ja: 'ディスコグラフィを見る', en: 'Open the discography' },
  },
  {
    id: 'clips',
    q: {
      ja: '湊あくあの名シーンや切り抜きを振り返るには？',
      en: "Where can I rewatch Minato Aqua's best moments and clips?",
    },
    a: {
      ja: '切り抜きの章に、YouTubeでいちばん見られている湊あくあの切り抜き30本（2026年10月11日時点）を集めています。どの切り抜きにも、作ってくれた人のクレジットを付けています。',
      en: 'The Clips chapter collects the 30 most-viewed fan clips of Minato Aqua on YouTube (as of 2026-10-11), each credited to the clipper who made it.',
    },
    href: '/clips',
    link: { ja: '切り抜きを見る', en: 'Open the clips' },
  },
  {
    id: 'art',
    q: {
      ja: '湊あくあの公式イラストや衣装を見られますか？',
      en: "Can I see Minato Aqua's official art and outfits?",
    },
    a: {
      ja: 'アートの章に、衣装・記念日・楽曲ジャケット・コラボなどの公式アートとコラボアートを、作者のクレジットつきで集めています。',
      en: 'The Arts chapter is a gallery of her official and collaboration art (outfits, anniversaries, song jackets and collaborations), each credited to its artist.',
    },
    href: '/arts',
    link: { ja: 'アートを見る', en: 'Open the gallery' },
  },
  {
    id: 'message',
    q: { ja: 'あくたんへメッセージを残せますか？', en: 'Can I leave a message for Aqua?' },
    a: {
      ja: '寄せ書きの章で、あくたんへのメッセージを一枚ずつ残せます。登録はいりません。',
      en: 'Yes. The Message Board chapter lets fans leave a note for Akutan, one card at a time, with no account needed.',
    },
    href: '/messages',
    link: { ja: '寄せ書きへ', en: 'Open the message board' },
  },
];
