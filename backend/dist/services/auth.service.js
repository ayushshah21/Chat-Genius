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
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.generateJWTforGoogleUser = generateJWTforGoogleUser;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socket_service_1 = require("../socket/socket.service");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "secret";
function registerUser(email, password, name) {
    return __awaiter(this, void 0, void 0, function* () {
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        console.log('Starting user registration for:', email);
        return yield prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            // First, check if there are any public channels
            const publicChannels = yield tx.channel.findMany({
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
            const user = yield tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    status: 'online',
                    channels: publicChannels.length > 0 ? {
                        connect: publicChannels.map(channel => ({ id: channel.id }))
                    } : undefined
                },
                include: {
                    channels: true
                }
            });
            // Use the imported io instance to emit events
            if (socket_service_1.io) {
                socket_service_1.io.emit('user.new', {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatarUrl: user.avatarUrl,
                    status: user.status
                });
                socket_service_1.io.emit('user.status', {
                    id: user.id,
                    status: 'online'
                });
            }
            return user;
        }));
    });
}
function loginUser(email, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error("User not found");
        }
        // Check password
        const valid = yield bcrypt_1.default.compare(password, user.password || "");
        if (!valid) {
            throw new Error("Invalid password");
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1d" });
        return { user, token };
    });
}
function generateJWTforGoogleUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Generate a JWT for a user who signed in with Google
        const token = yield jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });
        return token;
    });
}
