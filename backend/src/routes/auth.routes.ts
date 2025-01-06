import { Router, Request, Response } from "express"; // Ensure proper imports
import passport from "../config/passport";
import * as authController from "../controllers/auth.controller";
import { authGuard } from "../middlewares/auth.middleware";

const router = Router();

// Local Auth
router.post("/register", (req, res) => {
    authController.register(req, res);
});

router.post("/login", (req, res) => {
    authController.login(req, res);
});

// Google OAuth
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google callback
router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/api/auth/login-failure",
    }),
    (req, res) => {
        authController.googleRedirect(req, res);
    }
);

router.get("/login-failure", (_req: Request, res: Response) => {
    res.status(401).json({ error: "Failed to authenticate with Google" });
});

// Logout endpoint
router.get("/logout", (req: Request, res: Response) => {
    req.logout(() => {
        res.clearCookie('connect.sid'); // Clear session cookie
        res.json({ message: "Logged out successfully" });
    });
});

// Protected example
router.get("/protected", authGuard, (req: Request, res: Response) => {
    authController.getProtectedData(req, res);
});

export default router;
