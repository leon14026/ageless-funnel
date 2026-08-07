-- Fix email-validation regex in the anon INSERT policies.
-- Applied to project osbaarjfafflzoftojbd on 2026-08-07.
--
-- Root cause: the intended '\.' escape (literal dot) in the original preorder/waitlist
-- policies was stored in the live database as '\\.' (double backslash). A double
-- backslash in a POSIX regex matches a LITERAL BACKSLASH, so the pattern required a
-- backslash inside the email address and rejected every real address. Effect: RLS
-- silently blocked ALL anon inserts into preorders and waitlist (and quiz_responses),
-- i.e. no pre-order or waitlist signup from the public site could ever be saved.
--
-- Fix: replace '\.' with the character class '[.]' (matches a literal dot) which carries
-- no backslash and therefore cannot be mangled by string/JSON escaping on the way in.

DROP POLICY IF EXISTS "waitlist public insert" ON public.waitlist;
CREATE POLICY "waitlist public insert" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    funnel = 'A'
    AND char_length(name) BETWEEN 1 AND 200
    AND char_length(email) <= 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    AND (phone IS NULL OR char_length(phone) BETWEEN 6 AND 20)
    AND (source IS NULL OR char_length(source) <= 100)
  );

DROP POLICY IF EXISTS "preorders public insert" ON public.preorders;
CREATE POLICY "preorders public insert" ON public.preorders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    funnel = 'A'
    AND char_length(name) BETWEEN 1 AND 200
    AND char_length(email) <= 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    AND char_length(phone) BETWEEN 6 AND 20
    AND tier IN ('1','3','6')
    AND payment_method IN ('bkash','bank','card')
    AND char_length(coalesce(txn_reference, '')) <= 100
  );

DROP POLICY IF EXISTS "quiz_responses public insert" ON public.quiz_responses;
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
