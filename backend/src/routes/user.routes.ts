import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as userController from "../controllers/user.controller";

const router = Router();

router.use(authGuard);

// Get user profile
router.get("/profile", (req, res) => {
    userController.getProfile(req, res);
});

// Update user profile
router.put("/update", (req, res) => {
    userController.updateProfile(req, res);
});

// Get available users for DMs
router.get("/available", (req, res) => {
    userController.getAvailableUsers(req, res);
});

export default router; 