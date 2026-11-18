-- Narrow SECURITY DEFINER function so super_admin (barberflow_platform)
-- can safely delete a tenant and all of its dependent rows in foreign-key order
-- without exposing direct SELECT access on customer/transaction tables.

CREATE OR REPLACE FUNCTION app_private.platform_delete_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM commission_entries WHERE tenant_id = p_tenant_id;
  DELETE FROM transaction_items WHERE tenant_id = p_tenant_id;
  DELETE FROM transactions WHERE tenant_id = p_tenant_id;
  DELETE FROM queue_entry_services WHERE tenant_id = p_tenant_id;
  DELETE FROM queue_entries WHERE tenant_id = p_tenant_id;
  DELETE FROM bookings WHERE tenant_id = p_tenant_id;
  DELETE FROM commission_rules WHERE tenant_id = p_tenant_id;
  DELETE FROM whatsapp_messages WHERE tenant_id = p_tenant_id;
  DELETE FROM whatsapp_usage WHERE tenant_id = p_tenant_id;
  DELETE FROM expenses WHERE tenant_id = p_tenant_id;
  DELETE FROM customer_consents WHERE tenant_id = p_tenant_id;
  DELETE FROM customers WHERE tenant_id = p_tenant_id;
  DELETE FROM audit_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM queue_counters WHERE tenant_id = p_tenant_id;
  DELETE FROM receipt_counters WHERE tenant_id = p_tenant_id;
  DELETE FROM barbers WHERE tenant_id = p_tenant_id;
  DELETE FROM services WHERE tenant_id = p_tenant_id;
  DELETE FROM products WHERE tenant_id = p_tenant_id;
  DELETE FROM users WHERE tenant_id = p_tenant_id;
  DELETE FROM tenant_profiles WHERE tenant_id = p_tenant_id;
  DELETE FROM tenants WHERE id = p_tenant_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION app_private.platform_delete_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.platform_delete_tenant(uuid) TO barberflow_platform;
