import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Configure the Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user with this googleId already exists
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        // If user does not exist, create one
        if (!user) {
          // The user’s Google profile might not always contain an email or displayName,
          // so be sure to handle that in production code.
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: profile.emails?.[0].value || "",
            },
          });
        }

        // Pass user to next stage
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// This is required for maintaining session state via Passport (optional if using session-based).
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
