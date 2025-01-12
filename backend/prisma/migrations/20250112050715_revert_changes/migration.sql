/*
  Warnings:

  - The `type` column on the `Channel` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PUBLIC';

-- DropEnum
DROP TYPE "ChannelType";
