/**
 * Keeper preview switch (docs/KEEPER-UPDATE-PLAN.md): true only under `astro dev` with KEEPER_PREVIEW=1.
 * Builds compile import.meta.env.DEV to false, so every `import.meta.env.DEV && keeperPreview()` check — and
 * the preview database, fake admin and sample analytics behind it — is removed from production.
 */
export const keeperPreview = (): boolean =>
  import.meta.env.DEV && typeof process !== 'undefined' && process.env.KEEPER_PREVIEW === '1';

export const PREVIEW_ADMIN = {
  id: 'preview-admin',
  email: 'preview@keeper.local',
  name: 'Preview keeper',
  twoFactorEnabled: true,
};
