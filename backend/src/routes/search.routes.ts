import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as searchController from "../controllers/search.controller";

const router = Router();

router.use(authGuard);

router.get("/messages", (req, res) => {
    searchController.searchMessages(req, res);
});

router.get("/direct-messages", (req, res) => {
    searchController.searchDirectMessages(req, res);
});


export default router; 