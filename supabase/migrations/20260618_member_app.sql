-- Member app: programs + workout videos, food & progress tracking, entitlement gate.
-- Applied to project osbaarjfafflzoftojbd. Access is granted manually (owner/preorders)
-- until the SSLCommerz orders flow lands in July; access_entitlements.order_id is nullable.

-- ========== Entitlement (the access gate; read by js/payment.js:hasActiveEntitlement) ==========
CREATE TABLE IF NOT EXISTS public.access_entitlements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz NOT NULL,
  source         text DEFAULT 'manual',   -- 'preorder' | 'manual' | 'sslcommerz' (future)
  order_id       uuid,                     -- nullable; linked when the orders flow lands (July)
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.access_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own access" ON public.access_entitlements;
CREATE POLICY "Users view own access" ON public.access_entitlements
  FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_status
  ON public.access_entitlements(user_id, status, ends_at);
-- No INSERT/UPDATE/DELETE policy: only the dashboard/service role grants access.

-- Helper: does the current user have active access? SECURITY DEFINER bypasses RLS (no recursion).
CREATE OR REPLACE FUNCTION public.is_entitled() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM access_entitlements
    WHERE user_id = auth.uid() AND status = 'active' AND ends_at >= now()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_entitled() FROM anon;  -- only signed-in users evaluate it

-- ========== Program content (entitled members only) ==========
CREATE TABLE IF NOT EXISTS public.program_weeks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number         integer NOT NULL UNIQUE,
  title               varchar(255) NOT NULL,
  description         text,
  workout_title       varchar(255),
  workout_description text,
  diet_title          varchar(255),
  diet_content        text,
  is_published        boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.program_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Entitled view published weeks" ON public.program_weeks;
CREATE POLICY "Entitled view published weeks" ON public.program_weeks
  FOR SELECT TO authenticated USING (is_published AND public.is_entitled());
CREATE INDEX IF NOT EXISTS idx_program_weeks_number ON public.program_weeks(week_number);

CREATE TABLE IF NOT EXISTS public.workout_videos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id          uuid REFERENCES public.program_weeks(id) ON DELETE CASCADE,
  title            varchar(255) NOT NULL,
  youtube_url      varchar(500) NOT NULL,
  duration_minutes integer,
  sort_order       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.workout_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Entitled view videos" ON public.workout_videos;
CREATE POLICY "Entitled view videos" ON public.workout_videos
  FOR SELECT TO authenticated USING (public.is_entitled());
CREATE INDEX IF NOT EXISTS idx_workout_videos_week ON public.workout_videos(week_id, sort_order);

-- ========== Per-user data (user owns own rows) ==========
CREATE TABLE IF NOT EXISTS public.user_program_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_id      uuid REFERENCES public.program_weeks(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_id)
);
ALTER TABLE public.user_program_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own progress" ON public.user_program_progress;
CREATE POLICY "Users own progress" ON public.user_program_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress ON public.user_program_progress(user_id, week_id);

CREATE TABLE IF NOT EXISTS public.progress_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  weight     decimal(5,2),
  calories   integer,
  chest decimal(5,2), waist decimal(5,2), hips decimal(5,2), thighs decimal(5,2), arms decimal(5,2),
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entry_date)
);
ALTER TABLE public.progress_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own entries" ON public.progress_entries;
CREATE POLICY "Users manage own entries" ON public.progress_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_date ON public.progress_entries(user_id, entry_date);

CREATE TABLE IF NOT EXISTS public.user_nutrition_goals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_type            varchar(50) CHECK (goal_type IN ('weight_loss','maintenance','muscle_gain')),
  daily_calorie_target integer,
  daily_protein_target integer,
  daily_carbs_target   integer,
  daily_fat_target     integer,
  weight decimal(5,2), height decimal(5,2), age integer,
  gender varchar(10) CHECK (gender IN ('female','male')),
  activity_level decimal(3,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_nutrition_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own goals" ON public.user_nutrition_goals;
CREATE POLICY "Users own goals" ON public.user_nutrition_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user ON public.user_nutrition_goals(user_id);

CREATE TABLE IF NOT EXISTS public.food_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date   date NOT NULL DEFAULT CURRENT_DATE,
  meal_type    varchar(20) CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  food_name    varchar(255) NOT NULL,
  calories integer, protein decimal(5,1), carbs decimal(5,1), fat decimal(5,1),
  serving_size varchar(100),
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own food entries" ON public.food_entries;
CREATE POLICY "Users own food entries" ON public.food_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON public.food_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_food_entries_meal ON public.food_entries(user_id, entry_date, meal_type);

CREATE TABLE IF NOT EXISTS public.custom_foods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_name    varchar(255) NOT NULL,
  calories integer NOT NULL, protein decimal(5,1), carbs decimal(5,1), fat decimal(5,1),
  serving_size varchar(100),
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own custom foods" ON public.custom_foods;
CREATE POLICY "Users own custom foods" ON public.custom_foods
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_custom_foods_user ON public.custom_foods(user_id);
