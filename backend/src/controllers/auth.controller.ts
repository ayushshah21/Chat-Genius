import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { getUserById } from "../services/user.service";
import { ENV_CONFIG } from '../config/env.config';

export async function register(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
        const user = await authService.registerUser(email, password);
        const token = await authService.generateJWTforGoogleUser(user.id);
        return res.status(201).json({ message: "User registered", user, token });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
}

export async function login(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
        const { user, token } = await authService.loginUser(email, password);
        return res.json({
            user: { email: user.email },  // Only send necessary user data
            token
        });
    } catch (error: any) {
        return res.status(401).json({ error: error.message });
    }
}

// For Google OAuth redirect
export async function googleRedirect(req: Request, res: Response) {
    const user = req.user as { id: string };
    if (!user) {
        return res.status(401).json({ error: "No user from Google" });
    }

    try {
        // Await the token generation
        const token = await authService.generateJWTforGoogleUser(user.id);

        return res.redirect(`${ENV_CONFIG.FRONTEND_URL}?token=${token}`);
    } catch (error) {
        console.error('Token generation error:', error);
        return res.status(500).json({ error: "Failed to generate token" });
    }
}

// Example: protected route
export async function getProtectedData(req: Request, res: Response) {
    const userId = (req as any).userId; // Get userId from the request
    try {
        const user = await getUserById(userId); // Fetch user data from your database
        return res.json({
            secretData: "This is protected data!",
            user: { email: user?.email } // Include user email in the response
        });
    } catch (error) {
        return res.status(404).json({ error: error });
    }
}
