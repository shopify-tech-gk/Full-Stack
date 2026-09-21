-- Ch5.4 (logistics-service): deliberate, documented, MINIMAL-SCOPE grant
-- extension. logistics-service manages a shipment AND its tracking
-- timeline as one bounded context - rather than running two Prisma
-- clients/connection pools in a single process (one per role), it
-- connects as a SINGLE role (logistics_svc) that is granted access to
-- BOTH the logistics schema (already had this) and the tracking schema
-- (new below). This does NOT touch or weaken any other service's
-- isolation - tracking_svc (Ch2) is left fully defined and unused for now
-- (available if a future architecture wants to split shipment/tracking
-- into separate services); no other role is touched.
GRANT USAGE ON SCHEMA "tracking" TO "logistics_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "tracking" TO "logistics_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "tracking" TO "logistics_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "tracking" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "logistics_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "tracking" GRANT USAGE, SELECT ON SEQUENCES TO "logistics_svc";
