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

    // Listen for new DMs
    socket.on("new_dm", (message: DirectMessage) => {
      if (!userId) return;
      if (message.senderId === userId || message.receiverId === userId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      socket.off("new_dm");
    };
  }, [userId]);

  if (!userId) return null;

  const handleSendMessage = async (content: string) => {
    try {
      await axiosInstance.post(API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.CREATE, {
        content,
        receiverId: userId,
      });
    } catch (error) {
      console.error("Failed to send DM:", error);
    }
  };

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
              message.senderId === userId ? "justify-start" : "justify-end"
            }`}
          >
            <div className="max-w-[70%] bg-white rounded-lg shadow p-3">
              <p className="text-sm text-gray-700">{message.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <MessageInput onSend={handleSendMessage} />
      </div>
    </div>
  );
}
