import { useState } from "react";
import { Send } from "lucide-react";
import { socket } from "../../lib/socket";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";

interface Props {
  channelId?: string | null;
  dmUserId?: string | null;
  onSend?: (content: string) => Promise<void>;
  onMessageSent?: () => void;
  parentId?: string;
  placeholder?: string;
  isThread?: boolean;
}

export default function MessageInput({
  channelId,
  dmUserId,
  onMessageSent,
  parentId,
  placeholder = "Type a message...",
  isThread = false,
}: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      if (channelId) {
        // Send message through API first
        const response = await axiosInstance.post(
          API_CONFIG.ENDPOINTS.MESSAGES.CREATE,
          {
            content: message,
            channelId,
            parentId,
          }
        );

        // Then emit socket event with the created message
        if (parentId) {
          socket.emit("new_reply", response.data);
        } else {
          socket.emit("new_message", response.data);
        }
      } else if (dmUserId) {
        socket.emit("send_dm", {
          content: message,
          receiverId: dmUserId,
        });
      }

      setMessage("");
      onMessageSent?.();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={!isThread ? "p-4" : undefined}>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-200"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 relative z-10"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
