"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannel = createChannel;
exports.getUserChannels = getUserChannels;
exports.getChannelById = getChannelById;
exports.getChannelMessages = getChannelMessages;
exports.getThreadMessages = getThreadMessages;
exports.joinChannel = joinChannel;
exports.leaveChannel = leaveChannel;
const channelService = __importStar(require("../services/channel.service"));
function createChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { name, type } = req.body;
        const userId = req.userId;
        console.log('[ChannelController] Received create channel request:', {
            body: req.body,
            extractedData: { name, type, userId },
            contentType: req.headers['content-type']
        });
        try {
            const channel = yield channelService.createChannel({ name, type, userId });
            console.log('[ChannelController] Channel created successfully:', channel);
            res.status(201).json(channel);
        }
        catch (error) {
            console.error('[ChannelController] Error creating channel:', {
                error,
                stack: error.stack,
                body: req.body
            });
            // Handle specific error types
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            // Default to 500 for unexpected errors
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function getUserChannels(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const userId = req.userId;
        try {
            const channels = yield channelService.getUserChannels(userId);
            res.json(channels);
        }
        catch (error) {
            console.error('[ChannelController] Error getting channels:', error);
            // Handle specific error types
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            // Default to 500 for unexpected errors
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function getChannelById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const channel = yield channelService.getChannelById(channelId);
            if (!channel) {
                return res.status(404).json({ error: 'Channel not found' });
            }
            res.json(channel);
        }
        catch (error) {
            console.error('[ChannelController] Error getting channel by id:', error);
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function getChannelMessages(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const messages = yield channelService.getChannelMessages(channelId, userId);
            res.json(messages);
        }
        catch (error) {
            console.error('[ChannelController] Error getting channel messages:', error);
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function getThreadMessages(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { messageId } = req.params;
        const userId = req.userId;
        try {
            const messages = yield channelService.getThreadMessages(messageId, userId);
            res.json(messages);
        }
        catch (error) {
            console.error('[ChannelController] Error getting thread messages:', error);
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function joinChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const channel = yield channelService.addMemberToChannel(channelId, userId);
            res.json(channel);
        }
        catch (error) {
            console.error('[ChannelController] Error joining channel:', error);
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function leaveChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const channel = yield channelService.removeMemberFromChannel(channelId, userId);
            res.json(channel);
        }
        catch (error) {
            console.error('[ChannelController] Error leaving channel:', error);
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('unauthorized')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('authentication'))) {
                return res.status(401).json({ error: error.message });
            }
            if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('permission')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('forbidden'))) {
                return res.status(403).json({ error: error.message });
            }
            if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('validation')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('required')) || ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('invalid'))) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
