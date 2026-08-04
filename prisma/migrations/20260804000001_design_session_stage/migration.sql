-- Design Session workflow stage.
--
-- Stage used to be derived from the four boolean flags. It cannot be any more:
-- ON_REPORT_3 is not expressible in terms of them. So it becomes a stored,
-- hand-picked field that moves independently of the flags, which stay as they
-- are — including `posted`, which is now separate from DesignStage.POSTED.
--
-- Additive and non-destructive: every existing row starts at IN_SESSION via the
-- column default, and no flag data is touched.

-- CreateEnum
-- Values are in workflow order, not alphabetical: Postgres sorts an enum by
-- declaration order, which makes `ORDER BY stage` the workflow order for free.
CREATE TYPE "DesignStage" AS ENUM ('IN_SESSION', 'ON_REPORT_3', 'POSTED');

-- AlterTable
ALTER TABLE "DesignSession" ADD COLUMN "stage" "DesignStage" NOT NULL DEFAULT 'IN_SESSION';

-- CreateIndex
CREATE INDEX "DesignSession_stage_idx" ON "DesignSession"("stage");
