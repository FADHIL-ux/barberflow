-- Owners may rename their own barbershop. Plan, flags, and active status stay platform-only
-- because the column grant below covers `name` and nothing else.
CREATE POLICY own_tenant_update ON tenants FOR UPDATE TO barberflow_app
  USING (id = app_private.current_tenant_id())
  WITH CHECK (id = app_private.current_tenant_id());
GRANT UPDATE (name) ON tenants TO barberflow_app;
