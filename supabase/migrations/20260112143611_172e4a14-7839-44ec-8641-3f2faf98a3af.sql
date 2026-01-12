-- Create branding_settings table for client portal customization
CREATE TABLE public.branding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  company_logo_url TEXT,
  primary_color TEXT DEFAULT '#8B5CF6',
  accent_color TEXT DEFAULT '#F59E0B',
  tagline TEXT,
  website_url TEXT,
  support_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own branding settings" 
ON public.branding_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own branding settings" 
ON public.branding_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own branding settings" 
ON public.branding_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own branding settings" 
ON public.branding_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_branding_settings_updated_at
BEFORE UPDATE ON public.branding_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();