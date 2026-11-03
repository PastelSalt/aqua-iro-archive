# Keeper runbook

What to do when something about the Keeper (`/keeper`) goes wrong. Commands run from the project folder on your
own computer; they read `.env.production.local` (never commit it).

## Locked out of two-factor

Symptoms: the authenticator code and the backup codes are refused, or the two-factor page says "a server problem,
not a wrong code".

1. **Try a backup code** on the two-factor page ("Use a backup code instead"). Each works once.
2. **Check whether the server's key changed.** Better Auth encrypts the stored two-factor secret and the backup
   codes with `BETTER_AUTH_SECRET`. If Production's value changed after you set up two-factor, every code fails
   with `invalid tag` in the Vercel logs. Run:

   ```bash
   npm run admin:check-2fa
   ```

   It prints only whether the secret in `.env.production.local` can decrypt the stored data, never the secret.

   - **"decrypts"**: that local value is the original. In Vercel → aqua-iro-archive → Settings → Environment
     Variables, set Production `BETTER_AUTH_SECRET` back to it and redeploy. Your existing authenticator and
     backup codes work again.
   - **"DOES NOT decrypt"**: go to step 3.

3. **Reset two-factor and set it up again:**

   ```bash
   npx tsx scripts/reset-2fa.ts you@example.com
   ```

   It deletes the two-factor enrolment, writes an audit row and sends a Discord alert. Then sign in at
   `/keeper/login` with your passphrase: you're taken to the setup page. Delete the old "Aqua Iro Archive" entry
   in your authenticator app, scan the new QR code and save the new backup codes.

**Never change `BETTER_AUTH_SECRET` in Vercel** unless you mean to reset two-factor and sign everyone out. Keep
the copy in `.env.production.local` identical to Production's.

## Too many attempts

Sign-in allows 5 tries and two-factor 10 tries per 10 minutes. Wait 10 minutes.

## Forgot the passphrase

While signed in, change it on **My account**. If it's forgotten, there is no email reset (sign-up and email are
off by design) and no reset script yet: `npm run admin:create` only creates a new admin and fails for an email
that already exists. A `reset-password` script (typed passphrase, like `admin:create`) would be the fix; ask for
it before you need it.

## Visitor stats say "unavailable"

The Keeper reads Umami (self-hosted at `aqua-umami.vercel.app`). Production needs `UMAMI_API_URL`
(`https://aqua-umami.vercel.app/api`), `UMAMI_API_KEY` (an `umami_…` key from Umami → Settings → API keys) and
`PUBLIC_UMAMI_WEBSITE_ID`, then a redeploy. The message in brackets says what Umami answered.

## Previewing the Keeper locally

```bash
npm run keeper:preview
```

Starts `astro dev` on port 4322 with a local made-up database (`.keeper-preview/`, from
`scripts/dev/keeper-preview-db.mts`), a stand-in admin and sample analytics. It never touches Neon or Umami, and
none of it exists in production builds. Delete `.keeper-preview/` to rebuild the sample data.
