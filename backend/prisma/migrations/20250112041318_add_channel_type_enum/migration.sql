-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'DIRECT';

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_dmId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_messageId_fkey";

-- DropIndex
DROP INDEX "File_dmId_idx";

-- DropIndex
DROP INDEX "File_messageId_idx";

-- AlterTable
ALTER TABLE "File" ALTER COLUMN "size" DROP DEFAULT,
ALTER COLUMN "key" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
