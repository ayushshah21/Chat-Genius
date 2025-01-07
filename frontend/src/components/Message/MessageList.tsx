/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState, useRef } from "react";
import { Message } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { socket } from "../../lib/socket";

interface Props {
  channelId?: string | null;
  dmUserId?: string | null;
}

export default function MessageList({ channelId, dmUserId }: Props) {
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
        if (channelId) {
          socket.emit("join_channel", channelId);
          const response = await axiosInstance.get(
            `${API_CONFIG.ENDPOINTS.MESSAGES.CHANNEL}/${channelId}`
          );
          setMessages(response.data);
        } else if (dmUserId) {
          // Join DM room for current user
          const currentUserId = localStorage.getItem("userId"); // You'll need to store this on login
          socket.emit("join_dm", currentUserId);
          // Join DM room for the other user
          socket.emit("join_dm", dmUserId);

          const response = await axiosInstance.get(
            `${API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.GET(dmUserId)}`
          );
          setMessages(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    return () => {
      if (channelId) {
        socket.emit("leave_channel", channelId);
      } else if (dmUserId) {
        const currentUserId = localStorage.getItem("userId");
        socket.emit("leave_dm", currentUserId);
        socket.emit("leave_dm", dmUserId);
      }
    };
  }, [channelId, dmUserId]);

  useEffect(() => {
    const messageHandler = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on("new_message", messageHandler);
    socket.on("new_dm", messageHandler); // Add DM handler

    return () => {
      socket.off("new_message", messageHandler);
      socket.off("new_dm", messageHandler);
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

function MessageItem({ message }: { message: Message | DirectMessage }) {
  const userInfo = "user" in message ? message.user : message.sender;

  if (!userInfo) return null;

  return (
    <div className="flex items-start space-x-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors duration-200">
      <img
        src={
          userInfo.avatarUrl ||
          `https://ui-avatars.com/api/?name=${
            userInfo.name || "User"
          }&background=random`
        }
        alt={userInfo.name || "User"}
        className="w-8 h-8 rounded-full"
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-900">
            {userInfo.name || userInfo.email}
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
