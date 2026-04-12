-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add a user_id column (UUID referencing auth.users)
ALTER TABLE budget_data
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Migrate your existing data row to your own user account.
--    Replace 'YOUR_EMAIL@example.com' with the email you'll sign up with.
--    Run this AFTER you've signed up so the user exists in auth.users.
--
--    UPDATE budget_data
--    SET user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com')
--    WHERE id = 1;

-- 3. Make user_id unique (one row per user) and NOT NULL
--    (Run step 2 first, then uncomment and run these)
--
--    ALTER TABLE budget_data ALTER COLUMN user_id SET NOT NULL;
--    ALTER TABLE budget_data ADD CONSTRAINT budget_data_user_id_unique UNIQUE (user_id);

-- 4. Enable Row Level Security
ALTER TABLE budget_data ENABLE ROW LEVEL SECURITY;

-- 5. Policy: users can only see their own data
CREATE POLICY "Users can view own data"
  ON budget_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Policy: users can insert their own data
CREATE POLICY "Users can insert own data"
  ON budget_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. Policy: users can update their own data
CREATE POLICY "Users can update own data"
  ON budget_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Policy: users can delete their own data
CREATE POLICY "Users can delete own data"
  ON budget_data
  FOR DELETE
  USING (auth.uid() = user_id);
