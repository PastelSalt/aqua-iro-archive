/**
 * Which official art dresses each chapter (IMPROVEMENT-PLAN §1.3): the key visual behind the title card,
 * the art section the side-rail filmstrip draws from, the pose on the chapter-change eyecatch, and the
 * vertical rail title. Art is always shown as-is (cropped / framed / moved, never edited).
 */
import type { ChapterId } from './chapters';

export type ChapterArt = {
  kv: string; // arts id
  rail: string; // arts section
  pose: string; // src/assets/poses/<pose>.webp
  railTitle: string; // vertical JP text on the right rail
  // object-position for the key visual: the title card is a wide strip, so a centred crop of a tall
  // portrait lands on the torso. Aim it at her face instead.
  focus?: string;
};

export const CHAPTER_ART: Record<ChapterId, ChapterArt> = {
  home: {
    kv: 'music-aqua-iro-palette',
    rail: 'key-visuals',
    pose: 'full-08',
    railTitle: 'あくあ色アーカイブ',
    focus: 'center 12%',
  },
  about: {
    kv: 'gaou-v2',
    rail: 'outfits',
    pose: 'portrait-01',
    railTitle: 'ドジっ子メイドのプロフィール',
    focus: 'center 15%',
  },
  clips: {
    kv: 'anniv-2020-birthday-gaou',
    rail: 'anniversary',
    pose: 'mmd-smile',
    railTitle: 'みんなが残してくれた名場面',
    focus: 'center top',
  },
  discography: {
    kv: 'music-aqua-iro-palette',
    rail: 'music',
    pose: '3d-live-wink',
    railTitle: 'あくあ色の歌声',
    focus: 'center 12%',
  },
  streaming: {
    kv: 'anniv-4th-booota',
    rail: 'key-visuals',
    pose: 'portrait-03',
    railTitle: '六三九回の放送',
    focus: 'center 20%',
  },
  events: { kv: 'kv-5th-fes', rail: 'collabs', pose: '3d-peace', railTitle: '六年間の航海' },
  arts: {
    kv: 'gaou-aquart-1',
    rail: 'designer',
    pose: 'portrait-04',
    railTitle: 'あくあーとギャラリー',
    focus: 'center 27%',
  },
  messages: {
    kv: 'music-kimiiro-princess-art',
    rail: 'anniversary',
    pose: 'portrait-06',
    railTitle: 'あくたんへ、一枚ずつ',
    focus: 'center 30%',
  },
};
