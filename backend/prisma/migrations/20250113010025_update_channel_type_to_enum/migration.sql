/*
  Warnings:

  - You are about to drop the column `status` on the `File` table. All the data in the column will be lost.
  - Made the column `url` on table `File` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `File` required. This step will fail if there are existing NULL values in that column.
  - Made the column `key` on table `File` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_userId_fkey";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "status",
ALTER COLUMN "url" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "key" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
