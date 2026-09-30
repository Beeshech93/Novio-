-- Defense in depth for hosted Postgres (e.g. Supabase).
-- Nuvio reaches the database only through its own API with a privileged role, which bypasses RLS.
-- Enabling RLS with NO policies means any other role (Supabase's `anon` / `authenticated` REST API,
-- an accidentally leaked key, a read-only user...) sees zero rows and can write nothing.
-- Tenant isolation itself is enforced in the application layer (see README).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Remove API-role privileges when those roles exist (they don't on plain Postgres).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', current_schema(), r);
    END IF;
  END LOOP;
END $$;
