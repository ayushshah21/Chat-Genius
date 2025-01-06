import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();


export async function getUserById(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true } // Select only the email field
        });
        return user;
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        throw new Error("User not found");
    }
}
