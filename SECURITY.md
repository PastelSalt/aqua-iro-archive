# Security

Aqua Iro Archive runs a public message board and a small admin area (the Keeper), so security reports are very welcome.

## Reporting a problem

Please **don't open a public issue** for a vulnerability. Instead:

- use GitHub's [private vulnerability reporting](https://github.com/PastelSalt/aqua-iro-archive/security/advisories/new), or
- write through the Moeko Works contact form: <https://moekoworks.vercel.app/contact>.

Include what you found, how to reproduce it, and what it could affect. You'll get a reply within a few days.

## Scope

In scope: the site at <https://aqua-iro-archive.vercel.app> and this repository — the message board (`/api/messages`,
board actions), the analytics endpoint (`/api/hi`), and the Keeper (`/keeper`, `/api/admin`, sign-in and two-factor).

Out of scope: denial-of-service and volume testing, social engineering, and the third-party services the site uses
(Vercel, Neon, Cloudflare Turnstile, YouTube), which have their own programs.

## How the site protects people

- No accounts for visitors and no cookies for them. IP addresses are never stored: the board keeps a keyed hash that
  changes every month (for rate limits), visitor counting a salted hash that changes every day.
- Board posts pass Cloudflare Turnstile, server-side text checks, rate limits and keeper moderation.
- The Keeper has one admin with a passphrase plus mandatory TOTP two-factor; sign-up is disabled.
- A strict Content Security Policy with build-time script hashes, HSTS, and `frame-ancestors 'none'` (see `vercel.json`).
