import { useEffect, useState } from "react";
import { Message } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import { X, MessageSquare } from "lucide-react";
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
  const [replies, setReplies] = useState<(Message | DirectMessage)[]>([]);
  const [loading, setLoading] = useState(true);
  const userInfo =
    "user" in parentMessage ? parentMessage.user : parentMessage.sender;

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const endpoint =
          "user" in parentMessage
            ? API_CONFIG.ENDPOINTS.MESSAGES.THREAD(parentMessage.id)
            : API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.THREAD(parentMessage.id);
        const response = await axiosInstance.get(endpoint);
        setReplies(response.data);
      } catch (error) {
        console.error("Failed to fetch replies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReplies();

    // Listen for new replies
    const handleNewReply = (reply: Message | DirectMessage) => {
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

  const getUserInfo = (message: Message | DirectMessage) => {
    if ("user" in message) {
      return message.user;
    }
    return message.sender;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#1A1D21] text-white shadow-xl flex flex-col border-l border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#222529]">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold">Thread</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-700 rounded-full transition-colors duration-200"
        >
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Parent Message */}
      <div className="p-4 border-b border-gray-700 bg-[#222529]">
        <div className="flex items-start space-x-3">
          <img
            src={
              userInfo.avatarUrl ||
              `https://ui-avatars.com/api/?name=${
                userInfo.name || "User"
              }&background=random`
            }
            alt={userInfo.name || "User"}
            className="w-10 h-10 rounded-full border-2 border-gray-700"
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-white">
                {userInfo.name || userInfo.email}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(parentMessage.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-gray-100 mt-1">{parentMessage.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1A1D21]">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          replies.map((reply) => {
            const replyUserInfo = getUserInfo(reply);
            return (
              <div
                key={reply.id}
                className="flex items-start space-x-3 group hover:bg-[#222529] p-2 rounded-lg transition-colors duration-200"
              >
                <img
                  src={
                    replyUserInfo.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${
                      replyUserInfo.name || "User"
                    }&background=random`
                  }
                  alt={replyUserInfo.name || "User"}
                  className="w-8 h-8 rounded-full border border-gray-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-white">
                      {replyUserInfo.name || replyUserInfo.email}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(reply.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-gray-100 break-words">{reply.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Input */}
      <div className="p-4 border-t border-gray-700 bg-[#222529]">
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
