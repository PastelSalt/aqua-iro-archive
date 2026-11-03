/** Browser helpers for /keeper: Better Auth client (with two-factor). Toasts and dialogs live in ./keeper/ui. */
import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({ basePath: '/api/auth', plugins: [twoFactorClient()] });
export const signOut = () => authClient.signOut();
export { toast } from './keeper/ui';
