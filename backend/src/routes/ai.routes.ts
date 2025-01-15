import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as aiController from "../controllers/ai.controller";

const router = Router();

router.use(authGuard);

router.get("/search", (req, res) => {
    aiController.searchWithAI(req, res);
});

export default router; 