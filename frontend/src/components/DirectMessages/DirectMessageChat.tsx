import { useState, useEffect, useRef } from "react";
import { DirectMessage } from "../../types/directMessage";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { socket } from "../../lib/socket";
import MessageInput from "../Message/MessageInput";
import { useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import ThreadPanel from "../Message/ThreadPanel";
import EmojiReactions from "../Message/EmojiReactions";

export default function DirectMessageChat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = localStorage.getItem("userId");
  const [fileUrls, setFileUrls] = useState<{ [key: string]: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedThread, setSelectedThread] = useState<DirectMessage | null>(
    null
  );

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Add effect to scroll when messages or fileUrls change
  useEffect(() => {
    if (messages.length > 0) {
      console.log("Messages or files updated, scrolling to bottom");
      scrollToBottom();
    }
  }, [messages, fileUrls]);

  // Function to fetch file URLs
  const fetchFileUrls = async (message: DirectMessage) => {
    if (message.files && message.files.length > 0) {
      const urls: { [key: string]: string } = {};
      for (const file of message.files) {
        try {
          const response = await axiosInstance.get(
            API_CONFIG.ENDPOINTS.FILES.DOWNLOAD_URL(file.id)
          );
          urls[file.id] = response.data.url;
        } catch (error) {
          console.error("Failed to get download URL for file:", file.id, error);
        }
      }
      setFileUrls((prev) => ({ ...prev, ...urls }));
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      if (!userId || !currentUserId) return;

      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.GET(userId)
        );

        // Sort messages from oldest to newest
        const sortedMessages = response.data.sort(
          (a: DirectMessage, b: DirectMessage) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        setMessages(sortedMessages);

        // Fetch file URLs for all messages
        await Promise.all(
          sortedMessages.map((message: DirectMessage) => fetchFileUrls(message))
        );

        // Scroll to bottom after all files are loaded
        scrollToBottom();
      } catch (error) {
        console.error("Failed to fetch DM messages:", error);
      } finally {
        setLoading(false);
      }
    };

    // Call the fetchMessages function
    fetchMessages();

    // Create and join DM room
    if (userId && currentUserId) {
      const dmRoomId = [userId, currentUserId].sort().join(":");
      console.log("Joining DM room:", `dm:${dmRoomId}`);
      socket.emit("join_dm", userId);
    }

    // Listen for new DMs and replies
    const handleNewMessage = async (message: DirectMessage) => {
      console.log("Received new message:", {
        messageId: message.id,
        content: message.content,
        hasFiles: message.files && message.files.length > 0,
        isThreadReply: !!message.parentId,
      });

      if (
        (message.senderId === userId && message.receiverId === currentUserId) ||
        (message.senderId === currentUserId && message.receiverId === userId)
      ) {
        // Fetch file URLs before adding the message
        if (message.files && message.files.length > 0) {
          await fetchFileUrls(message);
        }

        // Only add to main list if it's not a thread reply
        if (!message.parentId) {
          setMessages((prev) => {
            // Check if message already exists
            const exists = prev.some((m) => m.id === message.id);
            if (exists) {
              // Update existing message
              return prev.map((m) => (m.id === message.id ? message : m));
            }
            // Add new message
            return [...prev, message];
          });
        } else {
          // Update the parent message's replies
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === message.parentId) {
                // Ensure replies array exists and add the new reply
                const currentReplies = msg.replies || [];
                const replyExists = currentReplies.some(
                  (r) => r.id === message.id
                );
                const updatedReplies = replyExists
                  ? currentReplies.map((r) =>
                      r.id === message.id ? message : r
                    )
                  : [...currentReplies, message];

                return { ...msg, replies: updatedReplies };
              }
              return msg;
            })
          );
        }

        // Scroll to bottom for new messages
        if (!message.parentId) {
          scrollToBottom();
        }
      }
    };

    socket.on("new_dm", handleNewMessage);
    socket.on("new_reply", handleNewMessage);

    return () => {
      if (userId && currentUserId) {
        const dmRoomId = [userId, currentUserId].sort().join(":");
        console.log("Leaving DM room:", `dm:${dmRoomId}`);
        socket.emit("leave_dm", userId);
      }
      socket.off("new_dm", handleNewMessage);
      socket.off("new_reply", handleNewMessage);
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
              {message.content && (
                <p className="text-sm text-gray-800">{message.content}</p>
              )}
              {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col space-y-2 bg-gray-100 p-2 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        {fileUrls[file.id] && (
                          <a
                            href={fileUrls[file.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-500"
                            download
                          >
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center space-x-4">
                <EmojiReactions
                  messageId={message.id}
                  isDM={true}
                  reactions={message.reactions || []}
                  key={`reactions-${message.id}-${JSON.stringify(
                    message.reactions
                  )}`}
                />
                <button
                  onClick={() => setSelectedThread(message)}
                  className="text-xs text-gray-500 hover:text-blue-600 flex items-center space-x-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>
                    {message.replies && message.replies.length > 0
                      ? `${message.replies.length} ${
                          message.replies.length === 1 ? "reply" : "replies"
                        }`
                      : "Reply"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Thread Panel */}
      {selectedThread && (
        <ThreadPanel
          parentMessage={selectedThread}
          onClose={() => setSelectedThread(null)}
        />
      )}

      {/* Message Input - Only show when no thread is open */}
      {!selectedThread && (
        <div className="p-4 border-t">
          <MessageInput dmUserId={userId} placeholder="Type a message..." />
        </div>
      )}
    </div>
  );
}
