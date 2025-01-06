"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.googleRedirect = googleRedirect;
exports.getProtectedData = getProtectedData;
const authService = __importStar(require("../services/auth.service"));
const user_service_1 = require("../services/user.service");
const env_config_1 = require("../config/env.config");
function register(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, password } = req.body;
        try {
            const user = yield authService.registerUser(email, password);
            const token = yield authService.generateJWTforGoogleUser(user.id);
            return res.status(201).json({ message: "User registered", user, token });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    });
}
function login(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { email, password } = req.body;
        try {
            const { user, token } = yield authService.loginUser(email, password);
            return res.json({
                user: { email: user.email }, // Only send necessary user data
                token
            });
        }
        catch (error) {
            return res.status(401).json({ error: error.message });
        }
    });
}
// For Google OAuth redirect
function googleRedirect(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "No user from Google" });
        }
        try {
            // Await the token generation
            const token = yield authService.generateJWTforGoogleUser(user.id);
            return res.redirect(`${env_config_1.ENV_CONFIG.FRONTEND_URL}?token=${token}`);
        }
        catch (error) {
            console.error('Token generation error:', error);
            return res.status(500).json({ error: "Failed to generate token" });
        }
    });
}
// Example: protected route
function getProtectedData(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = req.userId; // Get userId from the request
        try {
            const user = yield (0, user_service_1.getUserById)(userId); // Fetch user data from your database
            return res.json({
                secretData: "This is protected data!",
                user: { email: user === null || user === void 0 ? void 0 : user.email } // Include user email in the response
            });
        }
        catch (error) {
            return res.status(404).json({ error: error });
        }
    });
}
