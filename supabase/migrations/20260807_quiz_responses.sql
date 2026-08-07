-- Quiz lead capture for Funnel A.
-- Saves a row when a visitor finishes the quiz and submits the name/email gate,
-- BEFORE they pre-order — so drop-offs (finished quiz, never bought) are captured.
-- Applied to project osbaarjfafflzoftojbd on 2026-08-07.
-- Owner reviews rows via the Supabase dashboard (Table Editor uses the service role, bypassing RLS).

CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel      text NOT NULL DEFAULT 'A',
  name        text,
  email       text NOT NULL,
  answers     jsonb NOT NULL DEFAULT '{}'::jsonb,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_responses_created_at_idx ON public.quiz_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_responses_email_idx      ON public.quiz_responses (email);

-- ---------- Row Level Security: anon INSERT only, with field validation ----------
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.quiz_responses TO anon, authenticated;

CREATE POLICY "quiz_responses public insert" ON public.quiz_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    funnel = 'A'
    AND (name IS NULL OR char_length(name) <= 200)
    AND char_length(email) <= 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    AND jsonb_typeof(answers) = 'object'
    AND char_length(answers::text) <= 4000
    AND (source IS NULL OR char_length(source) <= 100)
  );
-- No SELECT / UPDATE / DELETE policies: anon can create a row but never read, edit, or remove any.
