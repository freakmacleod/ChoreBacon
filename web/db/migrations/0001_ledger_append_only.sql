-- point_ledger is append-only: balances are SUM(delta), so history must never change.
-- Corrections are new rows (reason = 'admin_adjustment'), never UPDATE/DELETE.
CREATE FUNCTION point_ledger_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'point_ledger is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER point_ledger_append_only
  BEFORE UPDATE OR DELETE ON point_ledger
  FOR EACH ROW EXECUTE FUNCTION point_ledger_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER point_ledger_no_truncate
  BEFORE TRUNCATE ON point_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION point_ledger_reject_mutation();
