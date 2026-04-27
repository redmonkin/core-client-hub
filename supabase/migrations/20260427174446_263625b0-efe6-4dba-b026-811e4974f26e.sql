-- Create briefs table
CREATE TABLE public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,

  -- Optional relations
  client_id UUID,
  project_id UUID,

  -- Content sections
  state TEXT,
  today_focus TEXT,
  pre_drafted_replies TEXT,
  follow_ups_owed TEXT,
  deferred TEXT,

  -- Quick-reference flags
  has_expiring_proposals BOOLEAN NOT NULL DEFAULT false,
  has_unsigned_contracts BOOLEAN NOT NULL DEFAULT false,
  has_overdue_items BOOLEAN NOT NULL DEFAULT false,
  item_count INT NOT NULL DEFAULT 0,

  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed BOOLEAN NOT NULL DEFAULT false,
  review_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT briefs_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX idx_briefs_user_date ON public.briefs(user_id, date DESC);

-- Validation trigger: prevent future-dated briefs (CHECK with CURRENT_DATE is not immutable)
CREATE OR REPLACE FUNCTION public.validate_brief_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Brief date cannot be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_brief_date_trigger
BEFORE INSERT OR UPDATE ON public.briefs
FOR EACH ROW EXECUTE FUNCTION public.validate_brief_date();

-- Updated_at trigger
CREATE TRIGGER update_briefs_updated_at
BEFORE UPDATE ON public.briefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

-- Strict owner-only policies (NOT shared with team)
CREATE POLICY "Users can view their own briefs"
  ON public.briefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own briefs"
  ON public.briefs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own briefs"
  ON public.briefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own briefs"
  ON public.briefs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);