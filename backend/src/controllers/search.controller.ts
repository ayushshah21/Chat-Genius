import { Request, Response } from "express";
import * as searchService from "../services/search.service";

export async function searchMessages(req: Request, res: Response) {
    const { query } = req.query;
    const userId = (req as any).userId;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
    }

    try {
        const messages = await searchService.searchMessages(query, userId);
        res.json(messages);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function searchDirectMessages(req: Request, res: Response) {
    const { query } = req.query;
    const userId = (req as any).userId;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
    }

    try {
        const messages = await searchService.searchDirectMessages(query, userId);
        res.json(messages);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}