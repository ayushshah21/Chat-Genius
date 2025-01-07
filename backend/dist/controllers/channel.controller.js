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
exports.joinChannel = joinChannel;
exports.leaveChannel = leaveChannel;
exports.createDMChannel = createDMChannel;
const channelService = __importStar(require("../services/channel.service"));
function createChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, type, memberIds } = req.body;
        const userId = req.userId; // From auth middleware
        try {
            const channel = yield channelService.createChannel(name, type, userId, memberIds);
            res.status(201).json(channel);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
}
function getUserChannels(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = req.userId;
        try {
            const channels = yield channelService.getUserChannels(userId);
            res.json(channels);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
}
function getChannelById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const channel = yield channelService.getChannelById(channelId);
            if (!channel) {
                return res.status(404).json({ error: "Channel not found" });
            }
            // Check if user is a member of the channel
            const isMember = channel.members.some(member => member.id === userId);
            if (!isMember && channel.type !== "PUBLIC") {
                return res.status(403).json({ error: "Not authorized to view this channel" });
            }
            res.json(channel);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
}
function joinChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const channel = yield channelService.getChannelById(channelId);
            if (!channel) {
                return res.status(404).json({ error: "Channel not found" });
            }
            if (channel.type === "PRIVATE") {
                return res.status(403).json({ error: "Cannot join private channel" });
            }
            const updatedChannel = yield channelService.addMemberToChannel(channelId, userId);
            res.json(updatedChannel);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
}
function leaveChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { channelId } = req.params;
        const userId = req.userId;
        try {
            const channel = yield channelService.getChannelById(channelId);
            if (!channel) {
                return res.status(404).json({ error: "Channel not found" });
            }
            if (channel.createdBy === userId) {
                return res.status(400).json({ error: "Channel creator cannot leave" });
            }
            yield channelService.removeMemberFromChannel(channelId, userId);
            res.json({ message: "Successfully left channel" });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
}
function createDMChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { otherUserId } = req.body;
        const userId = req.userId;
        console.log("Channel Controller: Creating DM channel", { userId, otherUserId });
        try {
            const channel = yield channelService.createDMChannel(userId, otherUserId);
            console.log("Channel Controller: DM channel created:", channel);
            res.json(channel);
        }
        catch (error) {
            console.error("Channel Controller: Failed to create DM channel:", error);
            res.status(400).json({ error: error.message });
        }
    });
}
