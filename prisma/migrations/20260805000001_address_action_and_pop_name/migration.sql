-- Addresses Tracker: Status → Action, optional reporter, new POP Name column.
--
-- The tracker turned out to be a hold list rather than a lifecycle, so the
-- four-value AddressRequestStatus collapses to a two-value AddressAction.
-- COMPLETED disappears with it, which means the completion invariant
-- (chk_address_completion, spec §7.4) no longer has a trigger and is dropped.
-- `completionDate` itself is KEPT, with its data, as a plain optional date.
--
-- Existing rows are mapped by agreement with the product owner:
--   ON_HOLD, BLOCKED        → ON_HOLD   (both are stalled work)
--   NOT_STARTED, COMPLETED  → OFF_HOLD
--
-- AuditLog rows are deliberately NOT rewritten. Rows written before this
-- migration keep fieldChanged = 'status' and their original enum values; the app
-- carries legacy labels so that history still renders. Rewriting an audit trail
-- to match a later schema would defeat the point of having one.

-- 1. The new enum.
CREATE TYPE "AddressAction" AS ENUM ('OFF_HOLD', 'ON_HOLD');

-- 2. Add the column nullable, backfill from status, then lock it down. Doing it
--    in this order means no row is ever left without an action.
ALTER TABLE "AddressRequest" ADD COLUMN "action" "AddressAction";

UPDATE "AddressRequest"
SET "action" = CASE
  WHEN "status" IN ('ON_HOLD', 'BLOCKED') THEN 'ON_HOLD'::"AddressAction"
  ELSE 'OFF_HOLD'::"AddressAction"
END;

ALTER TABLE "AddressRequest" ALTER COLUMN "action" SET NOT NULL;
ALTER TABLE "AddressRequest" ALTER COLUMN "action" SET DEFAULT 'OFF_HOLD';

-- 3. Completion is no longer a state, so the invariant has nothing to enforce.
--    chk_address_identifier (assumption A2) stays — it is still the backstop for
--    the bulk importer and any path that bypasses the zod schema.
--
--    This MUST come before the DROP COLUMN below. chk_address_completion is
--    defined on `status`, so dropping that column makes PostgreSQL drop the
--    constraint automatically; a later explicit DROP CONSTRAINT then fails with
--    42704 "does not exist". IF EXISTS keeps it safe either way.
ALTER TABLE "AddressRequest" DROP CONSTRAINT IF EXISTS "chk_address_completion";

-- 4. Retire the old column, its index and its enum type. AddressRequest.status
--    was the only user of AddressRequestStatus, so the type goes too.
DROP INDEX "AddressRequest_status_requestDate_idx";
ALTER TABLE "AddressRequest" DROP COLUMN "status";
DROP TYPE "AddressRequestStatus";

CREATE INDEX "AddressRequest_action_requestDate_idx" ON "AddressRequest"("action", "requestDate");

-- 5. Reporter becomes optional.
ALTER TABLE "AddressRequest" ALTER COLUMN "reporter" DROP NOT NULL;

-- 6. New free-text POP name.
ALTER TABLE "AddressRequest" ADD COLUMN "popName" TEXT;
