import { useState, useEffect, useRef } from "react";
import { DirectMessage } from "../../types/directMessage";
import { File } from "../../types/file";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { socket } from "../../lib/socket";
import MessageInput from "../Message/MessageInput";
import { useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import ThreadPanel from "../Message/ThreadPanel";
import EmojiReactions from "../Message/EmojiReactions";
import { DeleteButton } from "../Message/DeleteButton";
import { User } from "../../types/user";

export default function DirectMessageChat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const currentUserId = localStorage.getItem("userId");
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, boolean>>(
    {}
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedThread, setSelectedThread] = useState<DirectMessage | null>(
    null
  );
  const [users, setUsers] = useState<User[]>([]);

  const isPreviewable = (fileType: string) => {
    return fileType.startsWith("image/") || fileType === "application/pdf";
  };

  const handlePreviewError = (fileId: string) => {
    setPreviewErrors((prev) => ({ ...prev, [fileId]: true }));
  };

  const fetchFileUrlsForMessage = async (files: File[]) => {
    try {
      const urls: Record<string, string> = {};
      for (const file of files) {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.FILES.DOWNLOAD_URL(file.id)
        );
        urls[file.id] = response.data.downloadUrl;
      }
      setFileUrls((prev) => ({ ...prev, ...urls }));
    } catch (error) {
      console.error("Error fetching file URLs:", error);
    }
  };

  useEffect(() => {
    messages.forEach((message) => {
      if (message.files && message.files.length > 0) {
        fetchFileUrlsForMessage(message.files);
      }
    });
  }, [messages]);

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

    const handleNewReply = (data: {
      reply: DirectMessage;
      parentMessage: DirectMessage & { replyCount: number };
    }) => {
      console.log("[DirectMessageChat] Received new_reply event:", {
        replyId: data.reply.id,
        parentId: data.reply.parentId,
        senderId: data.reply.senderId,
        receiverId: data.reply.receiverId,
        currentUserId,
        otherUserId: userId,
        parentReplyCount: data.parentMessage.replyCount,
        testValue:
          data.parentMessage.replyCount === 999
            ? "TEST VALUE RECEIVED"
            : "NOT TEST VALUE",
      });

      // Check if this reply belongs to our DM conversation
      const isRelevantDM =
        (data.reply.senderId === currentUserId &&
          data.reply.receiverId === userId) ||
        (data.reply.senderId === userId &&
          data.reply.receiverId === currentUserId);

      console.log("[DirectMessageChat] Reply relevance check:", {
        isRelevantDM,
        conditions: {
          senderIsCurrentUser: data.reply.senderId === currentUserId,
          receiverIsOtherUser: data.reply.receiverId === userId,
          senderIsOtherUser: data.reply.senderId === userId,
          receiverIsCurrentUser: data.reply.receiverId === currentUserId,
        },
      });

      if (isRelevantDM) {
        setMessages((prev) => {
          console.log("[DirectMessageChat] Current messages before update:", {
            messageCount: prev.length,
            messages: prev.map((m) => ({
              id: m.id,
              replyCount: m.replies?.length || 0,
              isParent: m.id === data.reply.parentId,
            })),
          });

          const updated = prev.map((m) => {
            if (m.id === data.reply.parentId) {
              console.log("[DirectMessageChat] Updating parent message:", {
                parentId: m.id,
                currentReplies: m.replies?.length || 0,
                newReplyId: data.reply.id,
                receivedReplyCount: data.parentMessage.replyCount,
                isTestValue: data.parentMessage.replyCount === 999,
              });

              // Create updated message with new reply count
              const updatedMessage = {
                ...m,
                replies: [...(m.replies || []), data.reply],
                replyCount: data.parentMessage.replyCount,
              };

              console.log("[DirectMessageChat] Updated parent message:", {
                parentId: updatedMessage.id,
                newReplyCount: updatedMessage.replyCount,
                replyArrayLength: updatedMessage.replies.length,
                isTestValue: updatedMessage.replyCount === 999,
              });

              return updatedMessage;
            }
            return m;
          });

          console.log("[DirectMessageChat] Messages after update:", {
            messageCount: updated.length,
            messages: updated.map((m) => ({
              id: m.id,
              replyCount: m.replies?.length || 0,
              displayedReplyCount: m.replyCount,
              isParent: m.id === data.reply.parentId,
              isTestValue: m.replyCount === 999,
            })),
          });

          return updated;
        });
      } else {
        console.log(
          "[DirectMessageChat] Ignoring reply - not relevant to this DM conversation"
        );
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
    socket.on("new_reply", handleNewReply);
    socket.on("dm_deleted", handleDMDeleted);
    socket.on("reply_deleted", handleReplyDeleted);

    return () => {
      console.log("[DirectMessageChat] Cleaning up socket listeners");
      socket.off("new_dm", handleNewMessage);
      socket.off("new_reply", handleNewReply);
      socket.off("dm_deleted", handleDMDeleted);
      socket.off("reply_deleted", handleReplyDeleted);

      // Leave the DM room
      socket.emit("leave_dm", userId);
      console.log("[DirectMessageChat] Leaving DM room:", roomId);
    };
  }, [userId, currentUserId]);

  // Add useEffect to fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.USERS.AVAILABLE
        );
        setUsers(response.data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
  }, []);

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
                    dmUserId={userId}
                    isAuthor={message.sender.id === currentUserId}
                  />
                </div>
              </div>
              {message.content && (
                <p className="text-sm text-[var(--text)]">{message.content}</p>
              )}
              {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.files.map((file: File) => (
                    <div
                      key={file.id}
                      className="flex flex-col space-y-2 bg-[var(--background-light)] p-2 rounded"
                    >
                      {fileUrls[file.id] &&
                        isPreviewable(file.type) &&
                        !previewErrors[file.id] && (
                          <div className="max-w-md">
                            <img
                              src={fileUrls[file.id]}
                              alt={file.name}
                              className="rounded-md max-h-96 object-contain"
                              onError={() => handlePreviewError(file.id)}
                            />
                          </div>
                        )}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-[var(--text)]">
                            {file.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {fileUrls[file.id] && (
                            <a
                              href={fileUrls[file.id]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-sm text-[var(--primary)] hover:brightness-110 transition-colors duration-200"
                            >
                              {file.type === "application/pdf"
                                ? "Open PDF"
                                : "View"}
                            </a>
                          )}
                          <a
                            href={fileUrls[file.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-sm text-[var(--primary)] hover:brightness-110 transition-colors duration-200"
                            download
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center space-x-4">
                <EmojiReactions
                  messageId={message.id}
                  dmUserId={userId}
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
          <MessageInput
            dmUserId={userId}
            placeholder="Type a message..."
            users={users}
          />
        </div>
      )}
    </div>
  );
}
