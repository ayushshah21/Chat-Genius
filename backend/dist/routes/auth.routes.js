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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express"); // Ensure proper imports
const passport_1 = __importDefault(require("../config/passport"));
const authController = __importStar(require("../controllers/auth.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Local Auth
router.post("/register", (req, res) => {
    authController.register(req, res);
});
router.post("/login", (req, res) => {
    authController.login(req, res);
});
// Google OAuth
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
// Google callback
router.get("/google/callback", passport_1.default.authenticate("google", {
    failureRedirect: "/api/auth/login-failure",
}), (req, res) => {
    authController.googleRedirect(req, res);
});
router.get("/login-failure", (_req, res) => {
    res.status(401).json({ error: "Failed to authenticate with Google" });
});
// Logout endpoint
router.get("/logout", (req, res) => {
    req.logout(() => {
        res.clearCookie('connect.sid'); // Clear session cookie
        res.json({ message: "Logged out successfully" });
    });
});
// Protected example
router.get("/protected", auth_middleware_1.authGuard, (req, res) => {
    authController.getProtectedData(req, res);
});
exports.default = router;
