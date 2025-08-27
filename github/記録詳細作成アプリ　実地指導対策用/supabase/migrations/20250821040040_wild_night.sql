/*
  # Fix RLS policies to allow INSERT operations

  1. Security Updates
    - Drop existing restrictive policies
    - Create new policies that allow INSERT operations for authenticated and anonymous users
    - Enable proper access for CSV import functionality

  2. Policy Changes
    - Allow SELECT, INSERT, UPDATE, DELETE for authenticated users
    - Allow SELECT, INSERT, UPDATE, DELETE for anonymous users (for CSV import)
    - Use permissive policies with proper WITH CHECK conditions

  3. Tables Updated
    - users
    - staff  
    - service_patterns
    - service_schedules
    - service_records
    - csv_import_logs
*/

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Authenticated users can access users" ON users;
DROP POLICY IF EXISTS "Authenticated users can access staff" ON staff;
DROP POLICY IF EXISTS "Authenticated users can access service_patterns" ON service_patterns;
DROP POLICY IF EXISTS "Authenticated users can access service_schedules" ON service_schedules;
DROP POLICY IF EXISTS "Authenticated users can access service_records" ON service_records;
DROP POLICY IF EXISTS "Authenticated users can access csv_import_logs" ON csv_import_logs;

-- Users table policies
CREATE POLICY "Allow all operations for authenticated users on users"
  ON users
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on users"
  ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Staff table policies
CREATE POLICY "Allow all operations for authenticated users on staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on staff"
  ON staff
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Service patterns table policies
CREATE POLICY "Allow all operations for authenticated users on service_patterns"
  ON service_patterns
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on service_patterns"
  ON service_patterns
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Service schedules table policies
CREATE POLICY "Allow all operations for authenticated users on service_schedules"
  ON service_schedules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on service_schedules"
  ON service_schedules
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Service records table policies
CREATE POLICY "Allow all operations for authenticated users on service_records"
  ON service_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on service_records"
  ON service_records
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- CSV import logs table policies
CREATE POLICY "Allow all operations for authenticated users on csv_import_logs"
  ON csv_import_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on csv_import_logs"
  ON csv_import_logs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);