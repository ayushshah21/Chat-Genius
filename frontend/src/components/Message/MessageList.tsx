import { useEffect, useState, useRef } from "react";
import { Message } from "../../types/message";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { socket } from "../../lib/socket";

interface Props {
  channelId: string;
}

export default function MessageList({ channelId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        socket.emit("join_channel", channelId);

        const response = await axiosInstance.get(
          `${API_CONFIG.ENDPOINTS.MESSAGES.CHANNEL}/${channelId}`
        );
        setMessages(response.data);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    return () => {
      socket.emit("leave_channel", channelId);
    };
  }, [channelId]);

  useEffect(() => {
    const messageHandler = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on("new_message", messageHandler);

    return () => {
      socket.off("new_message", messageHandler);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex items-start space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 h-full">
      <div className="flex flex-col space-y-4 min-h-0">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  return (
    <div className="flex items-start space-x-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors duration-200">
      <img
        src={
          message.user.avatarUrl ||
          `https://ui-avatars.com/api/?name=${message.user.name}&background=random`
        }
        alt={message.user.name || "User"}
        className="w-8 h-8 rounded-full"
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-900">
            {message.user.name || message.user.email}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-gray-800 break-words">{message.content}</p>
      </div>
    </div>
  );
}
