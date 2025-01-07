import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as messageController from "../controllers/message.controller";

const router = Router();

router.use(authGuard);

router.get("/channel/:channelId", (req, res) => {
    messageController.getChannelMessages(req, res);
});
router.post("/", (req, res) => {
    messageController.createMessage(req, res);
});
// Thread messages
router.get("/thread/:messageId", messageController.getThreadMessages);

export default router;