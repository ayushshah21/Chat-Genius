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

  // Add debug logging for state changes
  useEffect(() => {
    console.log("State Change Debug:", {
      isSearchResult,
      hasHighlightedMessage,
      initialScrollDone,
      highlightMessageId,
      messageCount: messages.length,
    });
  }, [
    isSearchResult,
    hasHighlightedMessage,
    initialScrollDone,
    highlightMessageId,
    messages,
  ]);

  const clearSearchStates = (force = false, reason = "unspecified") => {
    console.log("Attempting to clear search states:", {
      force,
      reason,
      currentSearchState: isSearchResult,
      currentHighlightState: hasHighlightedMessage,
    });

    if (force) {
      console.log("Forcing clear of search states");
      setIsSearchResult(false);
      setHasHighlightedMessage(false);
    }
  };

  const scrollToBottom = () => {
    console.log("Scroll to bottom triggered:", {
      isSearchResult,
      hasHighlightedMessage,
      initialScrollDone,
      highlightMessageId,
    });

    if (!isSearchResult && !hasHighlightedMessage) {
      console.log("Executing scroll to bottom");
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      console.log("Scroll to bottom prevented due to:", {
        isSearchResult,
        hasHighlightedMessage,
      });
    }
  };

  const scrollToMessage = (messageId: string) => {
    console.log("Scroll to message triggered:", {
      messageId,
      messageExists: !!messageRefs.current[messageId],
      currentStates: {
        isSearchResult,
        hasHighlightedMessage,
        initialScrollDone,
      },
    });

    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.classList.add("highlight-message");

      // Log before timeout
      console.log("Message highlighted, setting timeout");

      setTimeout(() => {
        console.log("Highlight timeout completed for:", messageId);
        messageElement.classList.remove("highlight-message");
      }, 2000);

      setInitialScrollDone(true);
    } else {
      console.log("Message element not found:", messageId);
    }
  };

  // Update the highlightMessageId effect
  useEffect(() => {
    console.log("HighlightMessageId effect triggered:", {
      highlightMessageId,
      initialScrollDone,
      messageCount: messages.length,
    });

    if (highlightMessageId) {
      console.log("Setting search states for highlighted message");
      setIsSearchResult(true);
      setHasHighlightedMessage(true);

      if (!initialScrollDone) {
        console.log("Setting up scroll to highlighted message");
        const timer = setTimeout(() => {
          scrollToMessage(highlightMessageId);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightMessageId, messages, initialScrollDone]);

  // Update the messages change effect
  useEffect(() => {
    console.log("Messages change effect triggered:", {
      messageCount: messages.length,
      states: {
        highlightMessageId,
        initialScrollDone,
        isSearchResult,
        hasHighlightedMessage,
      },
    });

    if (
      !highlightMessageId &&
      initialScrollDone &&
      !isSearchResult &&
      !hasHighlightedMessage
    ) {
      console.log("Conditions met for auto-scroll");
      scrollToBottom();
    } else {
      console.log("Auto-scroll prevented due to:", {
        hasHighlightMessageId: !!highlightMessageId,
        initialScrollDone,
        isSearchResult,
        hasHighlightedMessage,
      });
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
    console.log("Channel/DM change effect triggered:", {
      channelId,
      dmUserId,
      currentStates: {
        isSearchResult,
        hasHighlightedMessage,
        initialScrollDone,
      },
    });

    clearSearchStates(true, "channel_change");
    setInitialScrollDone(false);
  }, [channelId, dmUserId]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        if (channelId) {
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
          const currentUserId = localStorage.getItem("userId");
          socket.emit("join_dm", currentUserId);
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
        socket.emit("leave_channel", channelId);
        socket.emit("leave_channel", `channel_${channelId}`);
      } else if (dmUserId) {
        const currentUserId = localStorage.getItem("userId");
        socket.emit("leave_dm", currentUserId);
        socket.emit("leave_dm", dmUserId);
      }
      setInitialScrollDone(false);
    };
  }, [channelId, dmUserId, highlightMessageId]);

  useEffect(() => {
    const messageHandler = (message: Message) => {
      // Only add to main list if it's not a thread reply
      if (!message.parentId) {
        console.log("Adding new message to main list:", {
          messageId: message.id,
          content: message.content,
          hasFiles:
            "files" in message && message.files && message.files.length > 0,
          isThreadReply: !!message.parentId,
        });
        setMessages((prev) => [message, ...prev]);
        clearSearchStates(true);
        scrollToBottom();
      }
    };

    const replyHandler = (reply: Message) => {
      console.log("Handling thread reply:", {
        replyId: reply.id,
        parentId: reply.parentId,
        content: reply.content,
        hasFiles: "files" in reply && reply.files && reply.files.length > 0,
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === reply.parentId
            ? { ...msg, replies: [...(msg.replies || []), reply] }
            : msg
        )
      );
    };

    socket.on("new_message", messageHandler);
    socket.on("new_dm", messageHandler);
    socket.on("new_reply", replyHandler);

    return () => {
      socket.off("new_message", messageHandler);
      socket.off("new_dm", messageHandler);
      socket.off("new_reply", replyHandler);
    };
  }, [isSearchResult]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#1A1D21]">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex items-start space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-1/4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 h-full relative flex flex-col bg-[#1A1D21]">
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
        <div className="pt-4 border-t border-gray-700 mt-auto">
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

const MessageItem = React.forwardRef<HTMLDivElement, MessageItemProps>(
  ({ message, onThreadClick, isHighlighted }, ref) => {
    const userInfo = "user" in message ? message.user : message.sender;
    const replyCount =
      "replies" in message && message.replies ? message.replies.length : 0;
    const [fileUrls, setFileUrls] = useState<{ [key: string]: string }>({});
    const [previewErrors, setPreviewErrors] = useState<{
      [key: string]: boolean;
    }>({});

    console.log("Rendering message:", {
      messageId: message.id,
      content: message.content,
      hasFiles: "files" in message && message.files && message.files.length > 0,
      files: "files" in message && message.files ? message.files : null,
      replyCount,
      replies: "replies" in message ? message.replies : null,
    });

    const isPreviewable = (type: string) => {
      return type.startsWith("image/"); // Remove PDF from previewable types
    };

    const handlePreviewError = (fileId: string) => {
      setPreviewErrors((prev) => ({ ...prev, [fileId]: true }));
    };

    useEffect(() => {
      const fetchFileUrls = async () => {
        if ("files" in message && message.files && message.files.length > 0) {
          const urls: { [key: string]: string } = {};
          for (const file of message.files) {
            try {
              const response = await axiosInstance.get(
                API_CONFIG.ENDPOINTS.FILES.DOWNLOAD_URL(file.id)
              );
              urls[file.id] = response.data.url;
            } catch (error) {
              console.error(
                "Failed to get download URL for file:",
                file.id,
                error
              );
            }
          }
          setFileUrls(urls);
        }
      };

      fetchFileUrls();
    }, [message]);

    if (!userInfo) return null;

    return (
      <div
        ref={ref}
        className={`flex items-start space-x-3 group hover:bg-[#222529] px-2 py-1 rounded transition-colors duration-200 ${
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
            <span className="font-medium text-white">
              {userInfo.name || userInfo.email}
            </span>
            <span className="text-xs text-gray-400">
              {formatMessageDate(new Date(message.createdAt))}
            </span>
          </div>
          {message.content && (
            <p className="text-gray-100 break-words">{message.content}</p>
          )}
          {"files" in message && message.files && message.files.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.files.map((file: FileAttachment) => (
                <div
                  key={file.id}
                  className="flex flex-col space-y-2 bg-[#222529] p-2 rounded"
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
                      <p className="text-sm text-gray-300">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {fileUrls[file.id] && (
                        <a
                          href={fileUrls[file.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
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
                        className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
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
              isDM={false}
              reactions={message.reactions || []}
            />
            <button
              onClick={onThreadClick}
              className="text-xs text-gray-400 hover:text-blue-400 flex items-center space-x-1 transition-colors duration-200"
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
  }
);
