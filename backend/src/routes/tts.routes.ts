import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as ttsController from "../controllers/tts.controller";

const router = Router();

router.use(authGuard);

router.post("/text-to-speech", (req, res) => {
    ttsController.textToSpeech(req, res);
});

router.get("/voices", (req, res) => {
    ttsController.getVoices(req, res);
});

router.post("/initialize-voice", (req, res) => {
    ttsController.initializeUserVoice(req, res);
});

export default router; 