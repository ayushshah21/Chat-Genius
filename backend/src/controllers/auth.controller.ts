import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { getUserById } from "../services/user.service";
import { ENV_CONFIG } from '../config/env.config';

export async function register(req: Request, res: Response) {
    const { email, password, name } = req.body;
    try {
        const user = await authService.registerUser(email, password, name);
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
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                status: user.status
            },
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
        // Return full user data in query params
        const userData = await getUserById(user.id);
        const userDataParam = encodeURIComponent(JSON.stringify({
            id: userData?.id,
            email: userData?.email,
            name: userData?.name,
            avatarUrl: userData?.avatarUrl,
            status: userData?.status
        }));

        return res.redirect(`${ENV_CONFIG.FRONTEND_URL}?token=${token}&userData=${userDataParam}`);
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
