/*
  # Create user_time_patterns table

  1. New Tables
    - `user_time_patterns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `pattern_id` (uuid, foreign key to service_patterns)
      - `start_time` (time)
      - `end_time` (time)
      - `day_of_week` (integer, 0=Sunday, 1=Monday, ..., 6=Saturday)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_time_patterns` table
    - Add policies for authenticated and anonymous users
*/

CREATE TABLE IF NOT EXISTS user_time_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  pattern_id uuid REFERENCES service_patterns(id) NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  day_of_week integer NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_time_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anonymous users on user_time_patterns"
  ON user_time_patterns
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on user_time_patterns"
  ON user_time_patterns
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);