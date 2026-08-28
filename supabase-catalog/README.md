# Catalog migration history

This directory owns the catalog/image database migrations that reference
`public.listings`, `public.listing_prices`, `public.listing_facilities`,
`public.facilities`, or `public.images`.

Do not copy these files into `supabase/migrations` and do not apply them to a
Tenant database. `supabase/migrations` is the complete source history for the
five Tenant databases.

Run catalog migrations only from the repository or Supabase project that owns
the catalog database.
