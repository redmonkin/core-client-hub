-- Add a unique, URL-friendly slug to branding_settings for public portfolio URLs
ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS slug text;

-- Case-insensitive uniqueness for slugs (when set)
CREATE UNIQUE INDEX IF NOT EXISTS branding_settings_slug_unique_idx
  ON public.branding_settings (lower(slug))
  WHERE slug IS NOT NULL;

-- Validation trigger: enforce slug format (3-40 chars, lowercase alphanum + hyphens, no leading/trailing hyphen)
CREATE OR REPLACE FUNCTION public.validate_branding_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(trim(NEW.slug));
    IF NEW.slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$' THEN
      RAISE EXCEPTION 'Invalid slug format. Use 3-40 lowercase letters, numbers, or hyphens (no leading/trailing hyphen).';
    END IF;
    -- Reserve a few obvious words
    IF NEW.slug IN ('admin','api','app','auth','dashboard','portfolio','portal','settings','public','www','assets','static') THEN
      RAISE EXCEPTION 'This slug is reserved. Please choose another.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_branding_slug_trg ON public.branding_settings;
CREATE TRIGGER validate_branding_slug_trg
  BEFORE INSERT OR UPDATE ON public.branding_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_branding_slug();

-- Recreate the public portfolio branding view to expose slug + add a slug-based lookup
DROP VIEW IF EXISTS public.public_portfolio_branding;
CREATE VIEW public.public_portfolio_branding
WITH (security_invoker = false)
AS
SELECT
  user_id,
  slug,
  company_name,
  company_logo_url,
  tagline,
  primary_color,
  accent_color,
  website_url,
  support_email
FROM public.branding_settings;

GRANT SELECT ON public.public_portfolio_branding TO anon, authenticated;