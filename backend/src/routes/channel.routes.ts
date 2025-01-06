import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as channelController from "../controllers/channel.controller";

const router = Router();

// All routes are protected
router.use(authGuard);

router.post("/", channelController.createChannel);
router.get("/", channelController.getUserChannels);
router.get("/:channelId", (req, res) => {
    channelController.getChannelById(req, res)
});
router.post("/:channelId/join", (req, res) => {
    channelController.joinChannel(req, res);
});
router.post("/:channelId/leave", (req, res) => {
    channelController.leaveChannel(req, res)
});

export default router; 