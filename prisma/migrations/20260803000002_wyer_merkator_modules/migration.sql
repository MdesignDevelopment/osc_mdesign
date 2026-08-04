-- CreateEnum
CREATE TYPE "AddressRequestStatus" AS ENUM ('NOT_STARTED', 'ON_HOLD', 'BLOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('DESIGN_SESSION', 'ADDRESS_REQUEST');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL', 'RUNNING');

-- CreateTable
CREATE TABLE "DesignSession" (
    "id" TEXT NOT NULL,
    "popZone" TEXT NOT NULL,
    "popZoneKey" TEXT NOT NULL,
    "cabinetName" TEXT,
    "mroPartner" TEXT,
    "notes" TEXT,
    "actionsDone" TEXT,
    "sendOcRequestToPartner" BOOLEAN NOT NULL DEFAULT false,
    "aapOnHold" BOOLEAN NOT NULL DEFAULT false,
    "readyToPost" BOOLEAN NOT NULL DEFAULT false,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptExecution" (
    "id" TEXT NOT NULL,
    "popZoneKey" TEXT NOT NULL,
    "designSessionId" TEXT,
    "scriptName" TEXT NOT NULL,
    "scriptVersion" TEXT,
    "status" "ScriptStatus" NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,
    "output" TEXT,
    "externalRef" TEXT,
    "executedByLabel" TEXT,
    "executedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressRequest" (
    "id" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "reporter" TEXT NOT NULL,
    "reportedById" TEXT,
    "tinaUuid" TEXT,
    "aapId" TEXT,
    "status" "AddressRequestStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "completionDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignSession_posted_readyToPost_idx" ON "DesignSession"("posted", "readyToPost");

-- CreateIndex
CREATE INDEX "DesignSession_mroPartner_idx" ON "DesignSession"("mroPartner");

-- CreateIndex
CREATE INDEX "DesignSession_updatedAt_idx" ON "DesignSession"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesignSession_popZoneKey_key" ON "DesignSession"("popZoneKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptExecution_externalRef_key" ON "ScriptExecution"("externalRef");

-- CreateIndex
CREATE INDEX "ScriptExecution_popZoneKey_executedAt_idx" ON "ScriptExecution"("popZoneKey", "executedAt");

-- CreateIndex
CREATE INDEX "ScriptExecution_designSessionId_idx" ON "ScriptExecution"("designSessionId");

-- CreateIndex
CREATE INDEX "AddressRequest_status_requestDate_idx" ON "AddressRequest"("status", "requestDate");

-- CreateIndex
CREATE INDEX "AddressRequest_tinaUuid_idx" ON "AddressRequest"("tinaUuid");

-- CreateIndex
CREATE INDEX "AddressRequest_aapId_idx" ON "AddressRequest"("aapId");

-- CreateIndex
CREATE INDEX "AddressRequest_requestDate_idx" ON "AddressRequest"("requestDate");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_changedAt_idx" ON "AuditLog"("entity", "entityId", "changedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_changedAt_idx" ON "AuditLog"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_changedAt_idx" ON "AuditLog"("entity", "changedAt");

-- CreateIndex
CREATE INDEX "AuditLog_changedAt_idx" ON "AuditLog"("changedAt");

-- CreateIndex
CREATE INDEX "OscRequest_popzone_idx" ON "OscRequest"("popzone");

-- CreateIndex
CREATE INDEX "OscRequest_status_idx" ON "OscRequest"("status");

-- AddForeignKey
ALTER TABLE "DesignSession" ADD CONSTRAINT "DesignSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_designSessionId_fkey" FOREIGN KEY ("designSessionId") REFERENCES "DesignSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressRequest" ADD CONSTRAINT "AddressRequest_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressRequest" ADD CONSTRAINT "AddressRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written additions (Prisma cannot express these in schema.prisma).
-- Do NOT apply this change set with `prisma db push` — it would drop them.
-- See SPEC-WYER-MERKATOR.md §3.7.
-- ---------------------------------------------------------------------------

-- Case/whitespace-insensitive matching between DesignSession.popZoneKey and
-- OscRequest.popzone. The two columns are populated by different import paths,
-- so casing/whitespace drift between them is expected. Backs the OSC Status
-- projection (spec §6.4), which normalises the OscRequest side at query time.
CREATE INDEX "idx_osc_request_popzone_norm" ON "OscRequest" (upper(btrim("popzone")));

-- Assumption A2: an address request must carry at least one external
-- identifier. Enforced in zod too; this is the backstop for bulk imports and
-- any future code path that bypasses the schema.
ALTER TABLE "AddressRequest"
  ADD CONSTRAINT "chk_address_identifier"
  CHECK ("tinaUuid" IS NOT NULL OR "aapId" IS NOT NULL);

-- Completion invariant (spec §7.4): a COMPLETED request always has a
-- completion date.
ALTER TABLE "AddressRequest"
  ADD CONSTRAINT "chk_address_completion"
  CHECK ("status" <> 'COMPLETED' OR "completionDate" IS NOT NULL);
