/*
  Warnings:

  - You are about to drop the column `isPrivate` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `directMessageId` on the `EmojiReaction` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `File` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Channel` table without a default value. This is not possible if the table is not empty.
  - Made the column `senderId` on table `DirectMessage` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `userId` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DirectMessage" DROP CONSTRAINT "DirectMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "EmojiReaction" DROP CONSTRAINT "EmojiReaction_directMessageId_fkey";

-- DropIndex
DROP INDEX "EmojiReaction_emoji_userId_directMessageId_key";

-- DropIndex
DROP INDEX "EmojiReaction_emoji_userId_messageId_key";

-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "isPrivate",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "DirectMessage" ALTER COLUMN "senderId" SET NOT NULL;

-- AlterTable
ALTER TABLE "EmojiReaction" DROP COLUMN "directMessageId",
ADD COLUMN     "dmId" TEXT;

-- AlterTable
ALTER TABLE "File" DROP COLUMN "key",
DROP COLUMN "updatedAt",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiSettings" JSONB,
ADD COLUMN     "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commonPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "communicationStyle" TEXT DEFAULT 'professional';

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmojiReaction" ADD CONSTRAINT "EmojiReaction_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
