import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

export async function registerUser(email: string, password: string) {
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  return user;
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
