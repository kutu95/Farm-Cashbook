-- 20240329000000 created pages without is_resolution.
-- 20240329000001 includes the column, but only inside CREATE TABLE IF NOT EXISTS,
-- so it did nothing once the table already existed. The publishing screen still
-- inserts is_resolution, which PostgREST rejects with 400.

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS is_resolution boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pages_resolution ON public.pages (is_resolution);
