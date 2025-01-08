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
        console.log('Google auth profile:', profile);

        // Check if user with this googleId already exists
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
          include: {
            channels: true
          }
        });

        // If user does not exist, create one
        if (!user) {
          console.log('Creating new Google user');

          // Start a transaction to handle user creation and channel membership
          user = await prisma.$transaction(async (tx) => {
            // Create the user first
            const newUser = await tx.user.create({
              data: {
                googleId: profile.id,
                email: profile.emails?.[0].value || "",
                name: profile.displayName,
                avatarUrl: profile.photos?.[0]?.value,
                status: 'online'
              },
              include: {
                channels: true
              }
            });

            // Get all public channels
            const publicChannels = await tx.channel.findMany({
              where: {
                OR: [
                  { type: "PUBLIC" },
                  { isPrivate: false }
                ]
              }
            });

            console.log('Found public channels:', publicChannels);

            // If there are public channels, add user to them
            if (publicChannels.length > 0) {
              await tx.user.update({
                where: { id: newUser.id },
                data: {
                  channels: {
                    connect: publicChannels.map(channel => ({ id: channel.id }))
                  }
                },
                include: {
                  channels: true
                }
              });
            }

            return newUser;
          });

          console.log('Created user with channels:', user);
        } else {
          console.log('Found existing user:', user);
        }

        // Pass user to next stage
        return done(null, user);
      } catch (error) {
        console.error('Google auth error:', error);
        return done(error);
      }
    }
  )
);

// This is required for maintaining session state via Passport
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        channels: true
      }
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
