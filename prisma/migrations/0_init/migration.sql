-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPPORT_ENGINEER', 'EXTERN');

-- CreateEnum
CREATE TYPE "OscStatus" AS ENUM ('OSC_UPDATED', 'EMAIL_SENT', 'EMAIL_SENT_REMINDER', 'ON_HOLD', 'CHECK_REMARKS');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH_PRIO', 'MEDIUM_PRIO', 'LOW_PRIO', 'NOT_DEFINED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SUPPORT_ENGINEER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OscRequest" (
    "id" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3),
    "partnerId" TEXT NOT NULL,
    "popzone" TEXT NOT NULL,
    "priority" "Priority",
    "status" "OscStatus" NOT NULL DEFAULT 'ON_HOLD',
    "remark" TEXT,
    "updatedDate" TIMESTAMP(3),
    "oscRequestDate" TIMESTAMP(3),
    "mailSentDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OscRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OscComment" (
    "id" TEXT NOT NULL,
    "oscRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OscComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OscHistory" (
    "id" TEXT NOT NULL,
    "oscRequestId" TEXT,
    "userId" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OscHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_name_key" ON "Partner"("name");

-- AddForeignKey
ALTER TABLE "OscRequest" ADD CONSTRAINT "OscRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OscRequest" ADD CONSTRAINT "OscRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OscComment" ADD CONSTRAINT "OscComment_oscRequestId_fkey" FOREIGN KEY ("oscRequestId") REFERENCES "OscRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OscComment" ADD CONSTRAINT "OscComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OscHistory" ADD CONSTRAINT "OscHistory_oscRequestId_fkey" FOREIGN KEY ("oscRequestId") REFERENCES "OscRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OscHistory" ADD CONSTRAINT "OscHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

