-- Server-generated secrets. RLS on, no policies: only the owner role used by the API can read it.
CREATE TABLE "app_secrets" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "app_secrets" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE "app_secrets" FROM %I', r);
    END IF;
  END LOOP;
END $$;
