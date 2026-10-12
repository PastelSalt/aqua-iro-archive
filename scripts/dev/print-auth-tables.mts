import { getAuthTables } from './../../node_modules/better-auth/node_modules/@better-auth/core/dist/db/get-tables.mjs';
import { twoFactor } from 'better-auth/plugins';
const t = getAuthTables({ plugins: [twoFactor()], rateLimit: { storage: 'database', enabled: true } } as never);
for (const [k, v] of Object.entries(t as Record<string, { modelName: string; fields: Record<string, { type: string; required?: boolean; unique?: boolean; references?: unknown; defaultValue?: unknown; index?: boolean; fieldName?: string }> }>)) {
  console.log(`\n${k} (${v.modelName})`);
  for (const [f, d] of Object.entries(v.fields)) console.log(`  ${f}: ${d.type}${d.required ? ' req' : ''}${d.unique ? ' unique' : ''}${d.index ? ' idx' : ''}${d.references ? ' ref=' + JSON.stringify(d.references) : ''}${d.defaultValue !== undefined ? ' default' : ''}`);
}
