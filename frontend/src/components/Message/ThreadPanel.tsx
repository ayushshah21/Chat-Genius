import React, { useEffect, useState } from "react";
import { Message } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import { X } from "lucide-react";
import MessageInput from "./MessageInput";
import { socket } from "../../lib/socket";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";

interface ThreadPanelProps {
  parentMessage: Message | DirectMessage;
  onClose: () => void;
}

export default function ThreadPanel({
  parentMessage,
  onClose,
}: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const userInfo =
    "user" in parentMessage ? parentMessage.user : parentMessage.sender;

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const response = await axiosInstance.get(
          `${API_CONFIG.ENDPOINTS.MESSAGES.THREAD}/${parentMessage.id}`
        );
        setReplies(response.data);
      } catch (error) {
        console.error("Failed to fetch replies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReplies();

    // Listen for new replies
    const handleNewReply = (reply: Message) => {
      if (reply.parentId === parentMessage.id) {
        setReplies((prev) => [...prev, reply]);
      }
    };

    socket.on("new_reply", handleNewReply);

    return () => {
      socket.off("new_reply", handleNewReply);
    };
  }, [parentMessage.id]);

  const handleMessageSent = () => {
    // Optionally handle any post-send actions
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold">Thread</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Parent Message */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-start space-x-3">
          <img
            src={
              userInfo.avatarUrl ||
              `https://ui-avatars.com/api/?name=${userInfo.name || "User"}`
            }
            alt={userInfo.name || "User"}
            className="w-8 h-8 rounded-full"
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">
                {userInfo.name || userInfo.email}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(parentMessage.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-gray-900">{parentMessage.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex items-start space-x-3">
              <img
                src={
                  reply.user.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${
                    reply.user.name || "User"
                  }`
                }
                alt={reply.user.name || "User"}
                className="w-8 h-8 rounded-full"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {reply.user.name || reply.user.email}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(reply.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-900">{reply.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply Input */}
      <div className="p-4 border-t relative z-10">
        <MessageInput
          channelId={
            "channelId" in parentMessage ? parentMessage.channelId : undefined
          }
          dmUserId={
            "receiverId" in parentMessage ? parentMessage.receiverId : undefined
          }
          parentId={parentMessage.id}
          placeholder="Reply in thread..."
          onMessageSent={handleMessageSent}
          isThread={true}
        />
      </div>
    </div>
  );
}
