-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "bankHint" TEXT,
    "accountName" TEXT,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "openingBalance" INTEGER,
    "closingBalance" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "postedAt" DATETIME NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "balanceAfter" INTEGER,
    "category" TEXT,
    "merchant" TEXT,
    "categoryConfidence" REAL,
    "categorizedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Transaction_statementId_idx" ON "Transaction"("statementId");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");
