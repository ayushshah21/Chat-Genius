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
import { DeleteButton } from "../Message/DeleteButton";

export default function DirectMessageChat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
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

  // Add handleDelete at component level
  const handleDelete = (messageId: string) => {
    console.log("[DirectMessageChat] Deleting message:", messageId);
    setMessages(messages.filter((m) => m.id !== messageId));
  };

  useEffect(() => {
    if (!userId || !currentUserId) return;

    console.log("[DirectMessageChat] Setting up socket listeners for DM:", {
      userId,
      currentUserId,
    });

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
        if (message.files && message.files.length > 0) {
          await fetchFileUrls(message);
        }

        if (!message.parentId) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === message.id);
            if (exists) {
              return prev.map((m) => (m.id === message.id ? message : m));
            }
            return [...prev, message];
          });
        }
      }
    };

    const handleDMDeleted = (data: { messageId: string; senderId: string }) => {
      console.log("[DirectMessageChat] Received dm_deleted event:", {
        messageId: data.messageId,
        senderId: data.senderId,
        currentMessages: messages.length,
        currentUserId,
      });

      // For sender: remove immediately
      // For receiver: only remove if we receive the socket event
      if (data.senderId === currentUserId || socket.connected) {
        setMessages((prevMessages) => {
          console.log("[DirectMessageChat] Filtering messages:", {
            messageToDelete: data.messageId,
            beforeCount: prevMessages.length,
            messages: prevMessages.map((m) => ({
              id: m.id,
              senderId: m.senderId,
            })),
          });

          const filteredMessages = prevMessages.filter(
            (msg) => msg.id !== data.messageId
          );

          console.log("[DirectMessageChat] After filtering:", {
            afterCount: filteredMessages.length,
            wasDeleted: prevMessages.length !== filteredMessages.length,
          });

          return filteredMessages;
        });
      }
    };

    const handleReplyDeleted = (data: {
      messageId: string;
      parentId: string;
      senderId: string;
    }) => {
      console.log("[DirectMessageChat] Received reply_deleted event:", data);

      // For sender: remove immediately
      // For receiver: only remove if we receive the socket event
      if (data.senderId === currentUserId || socket.connected) {
        setMessages((prevMessages) => {
          const updatedMessages = prevMessages.map((msg) => {
            if (msg.id === data.parentId && msg.replies) {
              return {
                ...msg,
                replies: msg.replies.filter(
                  (reply) => reply.id !== data.messageId
                ),
              };
            }
            return msg;
          });
          return updatedMessages;
        });
      }
    };

    // Create a unique room ID for this DM conversation
    const dmRoomId = [currentUserId, userId].sort().join(":");
    const roomId = `dm:${dmRoomId}`;

    // Join the DM room
    socket.emit("join_dm", userId);
    console.log("[DirectMessageChat] Joining DM room:", roomId);

    socket.on("new_dm", handleNewMessage);
    socket.on("new_reply", handleNewMessage);
    socket.on("dm_deleted", handleDMDeleted);
    socket.on("reply_deleted", handleReplyDeleted);

    return () => {
      console.log("[DirectMessageChat] Cleaning up socket listeners");
      socket.off("new_dm", handleNewMessage);
      socket.off("new_reply", handleNewMessage);
      socket.off("dm_deleted", handleDMDeleted);
      socket.off("reply_deleted", handleReplyDeleted);

      // Leave the DM room
      socket.emit("leave_dm", userId);
      console.log("[DirectMessageChat] Leaving DM room:", roomId);
    };
  }, [userId, currentUserId]);

  if (!userId) return null;

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
            <div className="max-w-[70%] bg-[var(--message-bg)] rounded-lg shadow p-3 group">
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
                <span className="text-sm font-medium text-[var(--text)]">
                  {message.sender.name || message.sender.email}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <DeleteButton
                    messageId={message.id}
                    isDM={true}
                    isAuthor={message.sender.id === currentUserId}
                    onDelete={() => handleDelete(message.id)}
                  />
                </div>
              </div>
              {message.content && (
                <p className="text-sm text-[var(--text)]">{message.content}</p>
              )}
              {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col space-y-2 bg-[var(--background-light)] p-2 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-[var(--text)]">
                            {file.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        {fileUrls[file.id] && (
                          <a
                            href={fileUrls[file.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-sm text-[var(--primary)] hover:brightness-110"
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
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center space-x-1"
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
