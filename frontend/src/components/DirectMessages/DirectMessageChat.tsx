import { useState, useEffect } from "react";
import { DirectMessage } from "../../types/directMessage";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { socket } from "../../lib/socket";
import MessageInput from "../Message/MessageInput";
import { useParams } from "react-router-dom";

export default function DirectMessageChat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = localStorage.getItem("userId");

  useEffect(() => {
    const fetchMessages = async () => {
      if (!userId) return;

      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.GET(userId)
        );
        setMessages(response.data);
      } catch (error) {
        console.error("Failed to fetch DM messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Join the DM room
    socket.emit("join_dm", userId);

    // Listen for new DMs
    const handleNewDM = (message: DirectMessage) => {
      if (message.senderId === userId || message.receiverId === userId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.on("new_dm", handleNewDM);

    return () => {
      socket.emit("leave_dm", userId);
      socket.off("new_dm", handleNewDM);
    };
  }, [userId, currentUserId]);

  if (!userId) return null;

  if (loading) {
    return <div>Loading messages...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === currentUserId
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div className="max-w-[70%] bg-white rounded-lg shadow p-3">
              <div className="flex items-center space-x-2 mb-1">
                <img
                  src={
                    message.sender.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${
                      message.sender.name || "User"
                    }`
                  }
                  alt={message.sender.name || "User"}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm font-medium">
                  {message.sender.name || message.sender.email}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-800">{message.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <MessageInput dmUserId={userId} placeholder="Type a message..." />
      </div>
    </div>
  );
}
