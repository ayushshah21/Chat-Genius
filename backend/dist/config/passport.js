"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Configure the Google Strategy
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Google auth profile:', profile);
        // Check if user with this googleId already exists
        let user = yield prisma.user.findUnique({
            where: { googleId: profile.id },
            include: {
                channels: true
            }
        });
        // If user does not exist, create one
        if (!user) {
            console.log('Creating new Google user');
            // Start a transaction to handle user creation and channel membership
            user = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c;
                // Create the user first
                const newUser = yield tx.user.create({
                    data: {
                        googleId: profile.id,
                        email: ((_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0].value) || "",
                        name: profile.displayName,
                        avatarUrl: (_c = (_b = profile.photos) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.value,
                        status: 'online'
                    },
                    include: {
                        channels: true
                    }
                });
                // Get public channels
                const channels = yield prisma.channel.findMany({
                    where: { type: 'PUBLIC' }
                });
                console.log('Found public channels:', channels);
                // If there are public channels, add user to them
                if (channels.length > 0) {
                    yield tx.user.update({
                        where: { id: newUser.id },
                        data: {
                            channels: {
                                connect: channels.map(channel => ({ id: channel.id }))
                            }
                        },
                        include: {
                            channels: true
                        }
                    });
                }
                return newUser;
            }));
            console.log('Created user with channels:', user);
        }
        else {
            console.log('Found existing user:', user);
        }
        // Pass user to next stage
        return done(null, user);
    }
    catch (error) {
        console.error('Google auth error:', error);
        return done(error);
    }
})));
// This is required for maintaining session state via Passport
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield prisma.user.findUnique({
            where: { id },
            include: {
                channels: true
            }
        });
        done(null, user);
    }
    catch (error) {
        done(error);
    }
}));
exports.default = passport_1.default;
