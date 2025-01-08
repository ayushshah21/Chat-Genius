-- AlterTable
ALTER TABLE "DirectMessage" ALTER COLUMN "content" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "content" DROP NOT NULL;
