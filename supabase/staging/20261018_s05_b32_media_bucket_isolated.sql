-- JENIOS S05-B32: storage for isolated S05 homologation ONLY.
-- Do not execute against jenios-social production (igayfjorjmucthlfoasf).
-- Mirrors existing production bucket metadata; no existing object or identity changes.
DO $guard$
BEGIN
  IF to_regclass('public.jenios_s04_staging_guard_20261017') IS NULL THEN
    RAISE EXCEPTION 'S05_MEDIA_STAGING_MARKER_MISSING';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.jenios_s04_staging_guard_20261017
    WHERE marker='JENIOS-S04-EXPLICIT-STAGING-20261017'
      AND environment='isolated-test-project'
  ) THEN
    RAISE EXCEPTION 'S05_MEDIA_NOT_ISOLATED';
  END IF;
  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='social-media') THEN
    RAISE EXCEPTION 'S05_MEDIA_BUCKET_ALREADY_EXISTS_REVIEW_MANUALLY';
  END IF;
END $guard$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
 'social-media','social-media',true,52428800,
 ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[]
);
-- No direct anonymous/authenticated object INSERT policy is created.
-- The existing /api/social/media route verifies the user and creates owner-scoped
-- signed upload URLs with the isolated service credential.
