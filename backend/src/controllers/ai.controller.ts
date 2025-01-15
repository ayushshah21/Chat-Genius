import { Request, Response } from "express";
import { AISearchService } from "../services/aiSearch.service";
import { PrismaService } from "../services/prisma.service";
import { VectorService } from "../services/vector.service";
import { AIService } from "../services/ai.service";
import { ConfigService } from "@nestjs/config";

// Create singleton instances
const configService = new ConfigService();
const prismaService = new PrismaService();
const vectorService = new VectorService(configService, prismaService);
const aiService = new AIService(configService, vectorService);
const aiSearchService = new AISearchService(prismaService, vectorService, aiService);

export async function searchWithAI(req: Request, res: Response) {
    const { query } = req.query;
    const userId = (req as any).userId;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
    }

    try {
        const result = await aiSearchService.performSearch(query, userId);
        res.json(result);
    } catch (error: any) {
        console.error('[AIController] Search error:', error);
        res.status(500).json({
            error: "Failed to perform AI search",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
} 