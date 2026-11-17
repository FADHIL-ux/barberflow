-- Allow customer deletion with cascading to customer_consents under tenant RLS.
GRANT DELETE ON customer_consents TO barberflow_app;
