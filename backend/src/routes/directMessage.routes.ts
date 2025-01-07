import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as directMessageController from "../controllers/directMessage.controller";

const router = Router();

router.use(authGuard);

router.post("/", (req, res) => {
    directMessageController.createDirectMessage(req, res);
});
router.get("/:otherUserId", (req, res) => {
    directMessageController.getDirectMessages(req, res);
});

export default router; 