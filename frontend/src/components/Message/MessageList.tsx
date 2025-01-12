/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState, useRef } from "react";
import { Message, FileAttachment } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { socket } from "../../lib/socket";
import ThreadPanel from "./ThreadPanel";
import { MessageCircle } from "lucide-react";
import MessageInput from "./MessageInput";
import EmojiReactions from "./EmojiReactions";
import { DeleteButton } from "./DeleteButton";

interface Props {
  channelId?: string | null;
  dmUserId?: string | null;
  highlightMessageId?: string | null;
}

function formatMessageDate(date: Date): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } else {
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " at " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
}

export default function MessageList({
  channelId,
  dmUserId,
  highlightMessageId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [isSearchResult, setIsSearchResult] = useState(false);
  const [hasHighlightedMessage, setHasHighlightedMessage] = useState(false);

  const handleMessageDeleted = (data: {
    messageId: string;
    channelId: string;
  }) => {
    if (data.channelId === channelId) {
      setMessages((prevMessages) => {
        const filteredMessages = prevMessages.filter(
          (msg) => msg.id !== data.messageId
        );
        return filteredMessages;
      });
    }
  };

  const handleReplyDeleted = (data: {
    messageId: string;
    parentId: string;
  }) => {
    setMessages((prevMessages) => {
      const updatedMessages = prevMessages.map((msg) => {
        if (msg.id === data.parentId && msg.replies) {
          const updatedReplies = msg.replies.filter(
            (reply) => reply.id !== data.messageId
          );
          return {
            ...msg,
            replies: updatedReplies,
          };
        }
        return msg;
      });
      return updatedMessages;
    });
  };

  const messageHandler = (message: Message) => {
    // Only add to main list if it's not a thread reply
    if (!message.parentId) {
      setMessages((prev) => [message, ...prev]);
      clearSearchStates(true);
      scrollToBottom();
    }
  };

  // const replyHandler = (reply: Message) => {
  //   setMessages((prev) =>
  //     prev.map((msg) =>
  //       msg.id === reply.parentId
  //         ? { ...msg, replies: [...(msg.replies || []), reply] }
  //         : msg
  //     )
  //   );
  // };

  const clearSearchStates = (force = false) => {
    if (force) {
      setIsSearchResult(false);
      setHasHighlightedMessage(false);
    }
  };

  const scrollToBottom = () => {
    if (!isSearchResult && !hasHighlightedMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.classList.add("highlight-message");

      setTimeout(() => {
        messageElement.classList.remove("highlight-message");
      }, 2000);

      setInitialScrollDone(true);
    }
  };

  // Update the highlightMessageId effect
  useEffect(() => {
    if (highlightMessageId) {
      setIsSearchResult(true);
      setHasHighlightedMessage(true);

      if (!initialScrollDone) {
        const timer = setTimeout(() => {
          scrollToMessage(highlightMessageId);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightMessageId, messages, initialScrollDone]);

  // Update the messages change effect
  useEffect(() => {
    if (
      !highlightMessageId &&
      initialScrollDone &&
      !isSearchResult &&
      !hasHighlightedMessage
    ) {
      scrollToBottom();
    }
  }, [
    messages,
    highlightMessageId,
    initialScrollDone,
    isSearchResult,
    hasHighlightedMessage,
  ]);

  // Update channel/DM change effect
  useEffect(() => {
    clearSearchStates(true);
    setInitialScrollDone(false);
  }, [channelId, dmUserId]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        if (channelId) {
          // Join both the regular channel room and the formatted channel room
          socket.emit("join_channel", channelId);
          socket.emit("join_channel", `channel_${channelId}`);

          const response = await axiosInstance.get(
            `${API_CONFIG.ENDPOINTS.MESSAGES.CHANNEL}/${channelId}`
          );
          setMessages(response.data);
          if (!highlightMessageId) {
            setInitialScrollDone(true);
          }
        } else if (dmUserId) {
          socket.emit("join_dm", dmUserId);

          const response = await axiosInstance.get(
            `${API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.GET(dmUserId)}`
          );
          setMessages(response.data);
          if (!highlightMessageId) {
            setInitialScrollDone(true);
          }
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
        // Leave both room formats
        socket.emit("leave_channel", channelId);
        socket.emit("leave_channel", `channel_${channelId}`);
      } else if (dmUserId) {
        socket.emit("leave_dm", dmUserId);
      }
      setInitialScrollDone(false);
    };
  }, [channelId, dmUserId, highlightMessageId]);

  useEffect(() => {
    socket.on("new_message", messageHandler);
    socket.on("new_dm", messageHandler);

    return () => {
      socket.off("new_message", messageHandler);
      socket.off("new_dm", messageHandler);
    };
  }, [isSearchResult]);

  useEffect(() => {
    if (!channelId) return;

    const handleNewMessage = (message: Message) => {
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
      }
    };

    const handleNewReply = (reply: Message) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === reply.parentId) {
            return {
              ...msg,
              replies: [...(msg.replies || []), reply],
            };
          }
          return msg;
        })
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("new_reply", handleNewReply);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("reply_deleted", handleReplyDeleted);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("new_reply", handleNewReply);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reply_deleted", handleReplyDeleted);
    };
  }, [channelId]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[var(--background)]">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex items-start space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-[var(--background-light)] rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[var(--background-light)] rounded w-1/4"></div>
              <div className="h-4 bg-[var(--background-light)] rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 h-full relative flex flex-col bg-[var(--background)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col space-y-1 min-h-0">
          {[...messages].reverse().map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onThreadClick={() => setSelectedThread(message)}
              ref={(el) => (messageRefs.current[message.id] = el)}
              isHighlighted={message.id === highlightMessageId}
              channelId={channelId}
              dmUserId={dmUserId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
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
        <div className="pt-4 border-t border-[var(--border)] mt-auto">
          <MessageInput
            channelId={channelId}
            dmUserId={dmUserId}
            placeholder={channelId ? "Message #channel" : "Message user"}
          />
        </div>
      )}
    </div>
  );
}

interface MessageItemProps {
  message: Message | DirectMessage;
  onThreadClick: () => void;
  isHighlighted?: boolean;
}

const MessageItem = React.forwardRef<
  HTMLDivElement,
  {
    message: Message | DirectMessage;
    onThreadClick: () => void;
    isHighlighted?: boolean;
    channelId?: string | null;
    dmUserId?: string | null;
  }
>(({ message, onThreadClick, isHighlighted, channelId, dmUserId }, ref) => {
  const userInfo = "user" in message ? message.user : message.sender;
  const currentUserId = localStorage.getItem("userId");
  const isDM = !("user" in message);
  const replyCount = message.replies?.length || 0;
  const [fileUrls, setFileUrls] = useState<{ [key: string]: string }>({});
  const [previewErrors, setPreviewErrors] = useState<{
    [key: string]: boolean;
  }>({});

  const isPreviewable = (type: string) => {
    return type.startsWith("image/");
  };

  const handlePreviewError = (fileId: string) => {
    setPreviewErrors((prev) => ({ ...prev, [fileId]: true }));
  };

  // Function to fetch file URLs for a message
  const fetchFileUrlsForMessage = async () => {
    if ("files" in message && message.files && message.files.length > 0) {
      const urls: { [key: string]: string } = {};
      for (const file of message.files) {
        try {
          const response = await axiosInstance.get(
            API_CONFIG.ENDPOINTS.FILES.DOWNLOAD_URL(file.id)
          );
          urls[file.id] = response.data.downloadUrl;
        } catch (error) {
          console.error("Failed to get download URL for file:", file.id, error);
        }
      }
      setFileUrls(urls);
    }
  };

  useEffect(() => {
    fetchFileUrlsForMessage();
  }, [message.files]);

  if (!userInfo) return null;

  return (
    <div
      ref={ref}
      className={`flex items-start space-x-3 group hover:bg-[var(--background-hover)] px-2 py-1 rounded transition-colors duration-200 ${
        isHighlighted ? "highlight-message" : ""
      }`}
    >
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
          <span className="font-medium text-[var(--text)]">
            {userInfo.name || userInfo.email}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {formatMessageDate(new Date(message.createdAt))}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DeleteButton
              messageId={message.id}
              channelId={"channelId" in message ? message.channelId : undefined}
              dmUserId={
                isDM ? (message as DirectMessage).receiverId : undefined
              }
              isAuthor={
                isDM
                  ? (message as DirectMessage).sender.id === currentUserId
                  : (message as Message).user.id === currentUserId
              }
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
                    <p className="text-sm text-[var(--text)]">{file.name}</p>
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
                        {file.type === "application/pdf" ? "Open PDF" : "View"}
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
            channelId={channelId || undefined}
            dmUserId={dmUserId || undefined}
            reactions={message.reactions || []}
          />
          <button
            onClick={onThreadClick}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center space-x-1 transition-colors duration-200"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>
              {replyCount > 0
                ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
                : "Reply"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});
