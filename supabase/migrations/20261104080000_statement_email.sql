-- Record a successful monthly statement email so the 3rd-of-month run does not send it twice.
CREATE TABLE IF NOT EXISTS public.statement_email_sends (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_end DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, period_end)
);

ALTER TABLE public.statement_email_sends ENABLE ROW LEVEL SECURITY;

INSERT INTO public.pages (slug, title, content, meta_description, is_published, is_resolution)
SELECT
  'statement-email',
  'Farm statement to {{end_date}}',
  E'Hello {{name}},\n\nYour statement up to {{end_date}} is attached.\n\nThe total you owe the farm is {{amount_owed}}.\n\nSynergy bills are in this folder: https://drive.google.com/drive/folders/1A-3aG0eZVZKzuu_4OEbYglnxe78qrTZJ\n\nBest regards,\nLandlife',
  'Wording of the monthly statement email. Placeholders: {{name}}, {{end_date}}, {{amount_owed}}.',
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.pages WHERE slug = 'statement-email'
);
