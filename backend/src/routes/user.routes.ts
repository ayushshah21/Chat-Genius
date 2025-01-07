import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as userController from "../controllers/user.controller";

const router = Router();

router.use(authGuard);
router.get("/available", (req, res) => {
    userController.getAvailableUsers(req, res);
});

export default router; 