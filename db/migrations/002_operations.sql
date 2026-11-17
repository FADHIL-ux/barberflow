-- Operational tables: customers, consent, queue, transactions, receipts,
-- commissions, expenses, WhatsApp quota, bookings.
-- Cross-tenant references are prevented with composite (tenant_id, id) foreign keys.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- Extra columns on 001 tables ----------
ALTER TABLE tenant_profiles ADD COLUMN logo_url text;
ALTER TABLE services ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0);
ALTER TABLE barbers ADD COLUMN phone text;
ALTER TABLE barbers ADD COLUMN photo_url text;
ALTER TABLE barbers ADD COLUMN skills text[] NOT NULL DEFAULT '{}';

ALTER TABLE barbers  ADD CONSTRAINT barbers_tenant_id_uq  UNIQUE (tenant_id, id);
ALTER TABLE services ADD CONSTRAINT services_tenant_id_uq UNIQUE (tenant_id, id);
ALTER TABLE products ADD CONSTRAINT products_tenant_id_uq UNIQUE (tenant_id, id);

-- ---------- Customers and consent (UU PDP) ----------
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR phone ~ '^[0-9+]{8,16}$'),
  hair_preference text,
  favorite_barber_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, favorite_barber_id) REFERENCES barbers (tenant_id, id)
    ON DELETE SET NULL (favorite_barber_id)
);
CREATE INDEX customers_tenant_name_idx ON customers (tenant_id, name);

-- Append-only history. The latest row per (customer, purpose) is the current status.
CREATE TABLE customer_consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('data_processing', 'whatsapp_reminder')),
  is_granted boolean NOT NULL,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX customer_consents_lookup_idx
  ON customer_consents (tenant_id, customer_id, purpose, recorded_at DESC);

-- ---------- Queue ----------
CREATE TABLE queue_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_date date NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, queue_date)
);

CREATE TABLE queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_date date NOT NULL,
  queue_number integer NOT NULL,
  customer_id uuid,
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 120),
  barber_id uuid,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_service', 'done', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, queue_date, queue_number),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id) ON DELETE SET NULL (customer_id),
  FOREIGN KEY (tenant_id, barber_id) REFERENCES barbers (tenant_id, id) ON DELETE SET NULL (barber_id)
);
CREATE INDEX queue_entries_board_idx ON queue_entries (tenant_id, queue_date, status);

CREATE TABLE queue_entry_services (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_entry_id uuid NOT NULL,
  service_id uuid NOT NULL,
  PRIMARY KEY (queue_entry_id, service_id),
  FOREIGN KEY (tenant_id, queue_entry_id) REFERENCES queue_entries (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, service_id) REFERENCES services (tenant_id, id) ON DELETE RESTRICT
);

-- ---------- Transactions and receipts ----------
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Authoritative receipt number, assigned by the server inside this same DB transaction.
  receipt_number bigint NOT NULL,
  -- Temporary number printed on an offline receipt, kept for reconciliation.
  temp_receipt_ref text,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 100),
  customer_id uuid,
  barber_id uuid,
  queue_entry_id uuid,
  subtotal_idr integer NOT NULL CHECK (subtotal_idr >= 0),
  discount_type text NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percent', 'fixed')),
  discount_value numeric(10, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_idr integer NOT NULL DEFAULT 0 CHECK (discount_idr >= 0),
  total_idr integer NOT NULL CHECK (total_idr >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  created_by uuid,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- SHA-256 of the public receipt token. The raw token is never stored.
  public_token_hash text NOT NULL UNIQUE,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, receipt_number),
  UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT transactions_total_chk CHECK (total_idr = subtotal_idr - discount_idr),
  CONSTRAINT transactions_discount_chk CHECK (discount_idr <= subtotal_idr),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id) ON DELETE SET NULL (customer_id),
  FOREIGN KEY (tenant_id, barber_id) REFERENCES barbers (tenant_id, id) ON DELETE SET NULL (barber_id),
  FOREIGN KEY (tenant_id, queue_entry_id) REFERENCES queue_entries (tenant_id, id) ON DELETE SET NULL (queue_entry_id)
);
CREATE INDEX transactions_tenant_time_idx ON transactions (tenant_id, occurred_at DESC);

CREATE TABLE transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL,
  position smallint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('service', 'product')),
  service_id uuid,
  product_id uuid,
  name_snapshot text NOT NULL,
  unit_price_idr integer NOT NULL CHECK (unit_price_idr >= 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  line_total_idr integer NOT NULL CHECK (line_total_idr = unit_price_idr * quantity),
  UNIQUE (tenant_id, id),
  CONSTRAINT transaction_items_ref_chk CHECK (
    (kind = 'service' AND service_id IS NOT NULL AND product_id IS NULL) OR
    (kind = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
  ),
  FOREIGN KEY (tenant_id, transaction_id) REFERENCES transactions (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, service_id) REFERENCES services (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX transaction_items_tx_idx ON transaction_items (transaction_id, position);

-- ---------- Commission ----------
CREATE TABLE commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  barber_id uuid,                       -- NULL = default rule for every barber
  type text NOT NULL CHECK (type IN ('percent', 'fixed')),
  value numeric(12, 2) NOT NULL CHECK (value >= 0),
  CONSTRAINT commission_percent_chk CHECK (type <> 'percent' OR value <= 100),
  FOREIGN KEY (tenant_id, service_id) REFERENCES services (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, barber_id) REFERENCES barbers (tenant_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX commission_rules_uq
  ON commission_rules (tenant_id, service_id, COALESCE(barber_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL,
  transaction_item_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  amount_idr integer NOT NULL CHECK (amount_idr >= 0),
  rule_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_item_id),
  FOREIGN KEY (tenant_id, transaction_id) REFERENCES transactions (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, transaction_item_id) REFERENCES transaction_items (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, barber_id) REFERENCES barbers (tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX commission_entries_barber_idx ON commission_entries (tenant_id, barber_id, created_at DESC);

-- ---------- Expenses ----------
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  category text NOT NULL CHECK (length(category) BETWEEN 2 AND 60),
  description text NOT NULL DEFAULT '',
  amount_idr integer NOT NULL CHECK (amount_idr > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_tenant_date_idx ON expenses (tenant_id, expense_date);

-- ---------- WhatsApp quota and message log ----------
CREATE TABLE whatsapp_usage (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  PRIMARY KEY (tenant_id, month)
);

CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid,
  template text NOT NULL,
  status text NOT NULL CHECK (status IN ('stubbed', 'sent', 'failed')),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id) ON DELETE SET NULL (customer_id)
);

-- ---------- Online booking (double booking blocked by an exclusion constraint) ----------
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL,
  service_id uuid NOT NULL,
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 120),
  customer_phone text CHECK (customer_phone IS NULL OR customer_phone ~ '^[0-9+]{8,16}$'),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_chk CHECK (ends_at > starts_at),
  FOREIGN KEY (tenant_id, barber_id) REFERENCES barbers (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, service_id) REFERENCES services (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, barber_id WITH =, tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'booked')
);
CREATE INDEX bookings_tenant_start_idx ON bookings (tenant_id, starts_at);

-- ---------- Row-Level Security on every new table ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'customer_consents', 'queue_counters', 'queue_entries', 'queue_entry_services',
    'transactions', 'transaction_items', 'commission_rules', 'commission_entries', 'expenses',
    'whatsapp_usage', 'whatsapp_messages', 'bookings'
  ]
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

-- Financial and consent records are append-only for the app role.
REVOKE DELETE ON transactions, transaction_items, commission_entries, customer_consents FROM barberflow_app;
REVOKE UPDATE ON transaction_items, commission_entries, customer_consents FROM barberflow_app;
GRANT USAGE ON SEQUENCE customer_consents_id_seq TO barberflow_app;

-- barberflow_platform gets NO grant on any table above. That is what keeps
-- super_admin away from customer and transaction data.

-- ---------- Narrow SECURITY DEFINER functions ----------
-- These run as the table owner (a superuser in the Docker image, which bypasses RLS).
-- Each returns only what its caller needs.

CREATE OR REPLACE FUNCTION app_private.session_is_valid(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT u.is_active AND COALESCE(t.is_active, true)
     FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = p_user_id),
    false)
$$;
REVOKE ALL ON FUNCTION app_private.session_is_valid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.session_is_valid(uuid) TO barberflow_app;

CREATE OR REPLACE FUNCTION app_private.tenant_by_slug(p_slug text)
RETURNS TABLE (id uuid, name text, plan text, feature_flags jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id, t.name, t.plan, t.feature_flags FROM tenants t WHERE t.slug = p_slug AND t.is_active
$$;
REVOKE ALL ON FUNCTION app_private.tenant_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.tenant_by_slug(text) TO barberflow_app;

-- Public receipt: returns a fixed set of fields. Customer phone is never included.
CREATE OR REPLACE FUNCTION app_private.get_public_receipt(p_token_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'receiptNumber', t.receipt_number,
    'barbershopName', tn.name,
    'address', tp.address,
    'footer', tp.receipt_footer,
    'paperWidthMm', tp.paper_width_mm,
    'occurredAt', t.occurred_at,
    'barberName', b.display_name,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', i.name_snapshot, 'quantity', i.quantity,
        'unitPriceIdr', i.unit_price_idr, 'lineTotalIdr', i.line_total_idr
      ) ORDER BY i.position)
      FROM transaction_items i WHERE i.transaction_id = t.id), '[]'::jsonb),
    'subtotalIdr', t.subtotal_idr,
    'discountIdr', t.discount_idr,
    'totalIdr', t.total_idr,
    'paymentMethod', t.payment_method
  )
  FROM transactions t
  JOIN tenants tn ON tn.id = t.tenant_id AND tn.is_active
  JOIN tenant_profiles tp ON tp.tenant_id = t.tenant_id
  LEFT JOIN barbers b ON b.id = t.barber_id AND b.tenant_id = t.tenant_id
  WHERE t.public_token_hash = p_token_hash
$$;
REVOKE ALL ON FUNCTION app_private.get_public_receipt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.get_public_receipt(text) TO barberflow_app;

-- Aggregate numbers for the super_admin panel. No customer rows leave the database.
CREATE OR REPLACE FUNCTION app_private.platform_tenant_stats()
RETURNS TABLE (tenant_id uuid, transaction_count bigint, whatsapp_used_this_month integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id,
         (SELECT count(*) FROM transactions x WHERE x.tenant_id = t.id),
         COALESCE((SELECT w.sent_count FROM whatsapp_usage w
                   WHERE w.tenant_id = t.id AND w.month = date_trunc('month', now())::date), 0)
  FROM tenants t
$$;
REVOKE ALL ON FUNCTION app_private.platform_tenant_stats() FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO barberflow_platform;
GRANT EXECUTE ON FUNCTION app_private.platform_tenant_stats() TO barberflow_platform;
