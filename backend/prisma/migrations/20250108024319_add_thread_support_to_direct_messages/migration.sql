-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
