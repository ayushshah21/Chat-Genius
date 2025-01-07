import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

export async function registerUser(email: string, password: string, name: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Starting user registration for:', email);

  return await prisma.$transaction(async (tx) => {
    // First, check if there are any public channels
    const publicChannels = await tx.channel.findMany({
      where: {
        type: "PUBLIC",
      },
      select: {
        id: true,
        name: true,
        type: true
      }
    });

    console.log('Available public channels:', publicChannels);

    // Create user with explicit many-to-many relation
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        channels: publicChannels.length > 0 ? {
          connect: publicChannels.map(channel => ({ id: channel.id }))
        } : undefined
      },
      include: {
        channels: true
      }
    });

    // Verify the connection was made
    const userWithChannels = await tx.user.findUnique({
      where: { id: user.id },
      include: {
        channels: true
      }
    });

    console.log('User channel memberships:', {
      userId: user.id,
      channelCount: userWithChannels?.channels.length,
      channelIds: userWithChannels?.channels.map(c => c.id)
    });

    return userWithChannels ?? user;
  });
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("User not found");
  }

  // Check password
  const valid = await bcrypt.compare(password, user.password || "");
  if (!valid) {
    throw new Error("Invalid password");
  }

  // Generate JWT
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1d" });
  return { user, token };
}

export async function generateJWTforGoogleUser(userId: string) {
  // Generate a JWT for a user who signed in with Google
  const token = await jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });
  return token;
}

