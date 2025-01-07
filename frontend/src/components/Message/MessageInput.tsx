import { useState } from "react";
import { Send } from 'lucide-react';
import { socket } from "../../lib/socket";

interface Props {
  channelId: string;
  onMessageSent?: () => void;
}

export default function MessageInput({ channelId }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      socket.emit("send_message", {
        content: message,
        channelId,
      });
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-200"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
