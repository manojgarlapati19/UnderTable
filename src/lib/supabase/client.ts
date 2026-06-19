// IMPORTANT: the third generic is forced to `Schema = any`.
//
// Reasoning: supabase-js's PostgrestQueryBuilder resolves a table's
// `Insert` / `Update` / `Row` types via the schema's `Tables` shape. When
// the schema has no Views / Functions / Enums, the only safe empty
// representations are `{}` or `{ [_ in never]: never }` — but supabase-js
// currently intersects `Tables & Views` internally and a phantom-`never`
// index signature still collapses the per-table type to `never[]`,
// breaking every `.insert(...)` / `.update(...)` / `.single()` call site
// with:
//   "Object literal may only specify known properties, and '<col>' does
//    not exist in type 'never[]'."
//
// Pinning the third generic to `any` opts every query builder out of
// schema-driven type inference (matches the legacy `supabase-js` v1
// behaviour). Read-side `Tables<>` / `Inserts<>` / `Updates<>` type
// aliases from `database.types.ts` still give us full row-level type
// safety in the application code; only the QueryBuilder inputs are
// untyped.
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<Database, 'public', any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
