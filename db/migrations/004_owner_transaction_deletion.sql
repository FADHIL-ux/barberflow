-- Allow transaction deletion and clearing for tenant-scoped operations.
-- Row-level security (RLS) ensures barberflow_app can only delete records belonging to its current tenant.
GRANT DELETE ON transactions, transaction_items, commission_entries TO barberflow_app;
