-- Core multi-tenant schema with Row-Level Security.
-- The app role sets `app.tenant_id` per transaction via set_config(..., true).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- ---------- Platform tables ----------
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  address text NOT NULL DEFAULT '',
  phone text,
  receipt_footer text NOT NULL DEFAULT 'Terima kasih, sampai jumpa kembali!',
  paper_width_mm smallint NOT NULL DEFAULT 58 CHECK (paper_width_mm IN (58, 80)),
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '21:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Users ----------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  role text NOT NULL CHECK (role IN ('owner', 'cashier', 'barber', 'super_admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- super_admin has no tenant; every other role must belong to one.
  CONSTRAINT users_role_tenant_chk CHECK (
    (role = 'super_admin' AND tenant_id IS NULL) OR (role <> 'super_admin' AND tenant_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE INDEX users_tenant_idx ON users (tenant_id);

-- Login must look up a user before the tenant is known, so it goes through
-- a narrow SECURITY DEFINER function instead of opening the table.
CREATE OR REPLACE FUNCTION app_private.find_user_for_login(p_email text)
RETURNS TABLE (id uuid, tenant_id uuid, password_hash text, full_name text, role text, tenant_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.id, u.tenant_id, u.password_hash, u.full_name, u.role,
         COALESCE(t.is_active, true)
  FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
  WHERE lower(u.email) = lower(p_email) AND u.is_active
$$;
REVOKE ALL ON FUNCTION app_private.find_user_for_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.find_user_for_login(text) TO barberflow_app;
GRANT USAGE ON SCHEMA app_private TO barberflow_app;

-- ---------- Barbers, services, products ----------
CREATE TABLE barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 80),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX barbers_tenant_idx ON barbers (tenant_id);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  price_idr integer NOT NULL CHECK (price_idr >= 0),
  duration_minutes smallint NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  price_idr integer NOT NULL CHECK (price_idr >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ---------- Receipt counter (final sequential number per tenant) ----------
CREATE TABLE receipt_counters (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  last_number bigint NOT NULL DEFAULT 0
);

-- ---------- Audit log ----------
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC);

-- ---------- Row-Level Security ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_profiles', 'users', 'barbers', 'services', 'products', 'receipt_counters', 'audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO barberflow_app
         USING (tenant_id = app_private.current_tenant_id())
         WITH CHECK (tenant_id = app_private.current_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO barberflow_app', t);
  END LOOP;
END $$;

-- audit_logs is append-only for the app role.
REVOKE UPDATE, DELETE ON audit_logs FROM barberflow_app;
GRANT USAGE ON SEQUENCE audit_logs_id_seq TO barberflow_app;

-- tenants: the app role can only see and update its own tenant row.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY own_tenant ON tenants FOR SELECT TO barberflow_app
  USING (id = app_private.current_tenant_id());
CREATE POLICY platform_all ON tenants FOR ALL TO barberflow_platform
  USING (true) WITH CHECK (true);
GRANT SELECT ON tenants TO barberflow_app;
GRANT SELECT, INSERT, UPDATE ON tenants TO barberflow_platform;

-- Platform role can create the first owner of a new tenant, but never read users back.
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_platform boolean NOT NULL DEFAULT false;
CREATE POLICY platform_insert_owner ON users FOR INSERT TO barberflow_platform
  WITH CHECK (role = 'owner');
GRANT INSERT ON users TO barberflow_platform;
CREATE POLICY platform_insert_profile ON tenant_profiles FOR INSERT TO barberflow_platform
  WITH CHECK (true);
GRANT INSERT ON tenant_profiles TO barberflow_platform;
CREATE POLICY platform_insert_counter ON receipt_counters FOR INSERT TO barberflow_platform
  WITH CHECK (true);
GRANT INSERT ON receipt_counters TO barberflow_platform;
