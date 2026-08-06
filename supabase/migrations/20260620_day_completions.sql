-- Cross-device workout progress: per-user day completions.
-- Replaces the localStorage-only tracking. RLS: each user manages only their own rows.

CREATE TABLE IF NOT EXISTS public.program_day_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_number  integer NOT NULL,
  day_number    integer NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_number, day_number)
);

ALTER TABLE public.program_day_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own day completions" ON public.program_day_completions;
CREATE POLICY "Users manage own day completions" ON public.program_day_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_day_completions_user ON public.program_day_completions(user_id);
