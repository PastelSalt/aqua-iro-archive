import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const I18n = z.object({ ja: z.string().min(1), en: z.string().min(1) });
const I18nPartial = z
  .object({ ja: z.string().optional(), en: z.string().optional() })
  .refine((v) => v.ja || v.en, 'need ja or en');
const YtId = z.string().regex(/^[\w-]{11}$/);
/** YYYY, YYYY-MM or YYYY-MM-DD ("2022" and "2022-10" exist in the data) */
const DateStr = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/);

export const SONG_KINDS = ['original', 'unit', 'cover-solo', 'cover-collab', 'release'] as const;
const songs = (path: string) =>
  defineCollection({
    loader: file(path),
    schema: z.object({
      id: z.string(),
      date: DateStr,
      title: z.string(),
      titleEn: z.string().optional(),
      kind: z.enum(SONG_KINDS),
      credits: z.string().optional(),
      with: z.array(z.string()).default([]),
      youtube: YtId.optional(),
      link: z.url().optional(),
      views: z.number().int().optional(),
      notes: I18nPartial.optional(),
      highlight: z.boolean().default(false),
      jacket: z.string().optional(), // arts id
    }),
  });

export const EVENT_TYPES = [
  'news',
  'milestone',
  'live',
  'collab',
  'music',
  'game',
  'brand',
  'announcement',
  'graduation',
  'model',
  'unit',
  'lore',
  'award',
] as const;
export const ART_SECTIONS = [
  'outfits',
  'key-visuals',
  'anniversary',
  'music',
  'collabs',
  'designer',
  'concept',
  '3d',
  'aquarium',
] as const;
export const CLIP_TAGS = ['animated', 'gaming', 'collab', 'funny', 'emotional', 'music'] as const;

export const collections = {
  profile: defineCollection({
    loader: file('src/content/about/profile.yaml'),
    schema: z.object({ id: z.string(), label: I18n, value: I18nPartial, order: z.number() }),
  }),
  lore: defineCollection({
    loader: file('src/content/about/lore.yaml'),
    schema: z.object({
      id: z.string(),
      text: I18nPartial,
      sticker: z.enum(['cat', 'onion', 'anchor', 'pad', 'heart', 'note']).optional(),
    }),
  }),
  relationships: defineCollection({
    loader: file('src/content/about/relationships.yaml'),
    schema: z.object({
      id: z.string(),
      name: I18nPartial,
      members: z.array(z.string()),
      kind: z.enum(['pair', 'unit', 'group']),
      note: I18nPartial.optional(),
    }),
  }),
  links: defineCollection({
    loader: file('src/content/about/links.yaml'),
    schema: z.object({
      id: z.string(),
      label: z.string(),
      text: z.string(),
      url: z.url(),
      note: z.string().optional(),
    }),
  }),
  clips: defineCollection({
    loader: file('src/content/clips/clips.yaml'),
    schema: z.object({
      id: YtId,
      rank: z.number(),
      title: z.string(),
      clipper: z.string(),
      clipperUrl: z.url().optional(),
      views: z.number(),
      published: DateStr.optional(),
      tags: z.array(z.enum(CLIP_TAGS)).min(1),
    }),
  }),
  originals: songs('src/content/songs/originals.yaml'),
  units: songs('src/content/songs/units.yaml'),
  coversSolo: songs('src/content/songs/covers-solo.yaml'),
  coversCollab: songs('src/content/songs/covers-collab.yaml'),
  releases: songs('src/content/songs/releases.yaml'),
  milestones: defineCollection({
    loader: file('src/content/streams/milestones.yaml'),
    schema: z.object({ id: YtId, date: DateStr, label: I18n, title: z.string().optional() }),
  }),
  records: defineCollection({
    loader: file('src/content/streams/records.yaml'),
    schema: z.object({
      id: z.string(),
      label: I18n,
      youtube: YtId.optional(),
      title: z.string().optional(),
      date: z.string(),
      figure: I18nPartial,
    }),
  }),
  subscribers: defineCollection({
    loader: file('src/content/streams/subscribers.yaml'),
    schema: z.object({ id: z.string(), date: DateStr, count: z.number() }),
  }),
  yearTotals: defineCollection({
    loader: file('src/content/streams/year-totals.yaml'),
    schema: z.object({ id: z.string(), streams: z.number(), hours: z.number() }),
  }),
  events: defineCollection({
    loader: file('src/content/events/timeline.yaml'),
    schema: z.object({
      id: z.string(),
      date: DateStr,
      dateLabel: z.string().optional(),
      type: z.enum(EVENT_TYPES),
      title: I18nPartial,
      body: I18nPartial.optional(),
      url: z.url().optional(),
      youtube: YtId.optional(),
      venue: z.string().optional(),
      setlist: z.url().optional(),
      visual: z.string().optional(), // arts id
    }),
  }),
  brands: defineCollection({
    loader: file('src/content/events/brands.yaml'),
    schema: z.object({ id: z.string(), name: z.string(), ja: z.string().optional() }),
  }),
  arts: defineCollection({
    loader: file('src/content/arts/arts.yaml'),
    schema: ({ image }) =>
      z.object({
        id: z.string(),
        file: z.string(),
        image: image(),
        section: z.enum(ART_SECTIONS),
        title: I18nPartial,
        date: DateStr.optional(),
        artist: z.string(),
        credit: z.string().default('© COVER Corp.'),
        source: z.url(),
        alt: I18n,
        featured: z.boolean().default(false),
        focal: z.enum(['top', 'center', 'bottom']).default('center'),
      }),
  }),
};
// Talk with Aqua is NOT a content collection: its files are YAML lists with nested nodes, so they are
// loaded with import.meta.glob('/src/content/talk/*.yaml', { query: '?raw', import: 'default', eager: true }),
// parsed with `yaml`, and validated with the shared Zod schema in src/lib/talk/schema.ts (§10.2–10.3).
