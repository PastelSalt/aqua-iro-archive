import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! }, // migrations use the direct (unpooled) URL
  strict: true,
  verbose: true,
});
