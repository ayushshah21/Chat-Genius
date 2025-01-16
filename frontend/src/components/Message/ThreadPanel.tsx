import { useEffect, useState } from "react";
import { Message } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import { X, MessageSquare } from "lucide-react";
import MessageInput from "./MessageInput";
import { socket } from "../../lib/socket";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";

interface ThreadPanelProps {
  parentMessage: Message | DirectMessage;
  onClose: () => void;
}

export default function ThreadPanel({
  parentMessage,
  onClose,
}: ThreadPanelProps) {
  const [replies, setReplies] = useState<(Message | DirectMessage)[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileUrls, setFileUrls] = useState<{ [key: string]: string }>({});
  const [previewErrors, setPreviewErrors] = useState<{
    [key: string]: boolean;
  }>({});
  const userInfo =
    "user" in parentMessage ? parentMessage.user : parentMessage.sender;

  const isPreviewable = (type: string) => {
    return type.startsWith("image/");
  };

  const handlePreviewError = (fileId: string) => {
    setPreviewErrors((prev) => ({ ...prev, [fileId]: true }));
  };

  // Function to fetch file URLs for a message
  const fetchFileUrlsForMessage = async (message: Message | DirectMessage) => {
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
      setFileUrls((prev) => ({ ...prev, ...urls }));
    }
  };

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const endpoint =
          "user" in parentMessage
            ? API_CONFIG.ENDPOINTS.MESSAGES.THREAD(parentMessage.id)
            : API_CONFIG.ENDPOINTS.DIRECT_MESSAGES.THREAD(parentMessage.id);
        const response = await axiosInstance.get(endpoint);
        setReplies(response.data);

        // Fetch file URLs for parent message and all replies
        await fetchFileUrlsForMessage(parentMessage);
        await Promise.all(response.data.map(fetchFileUrlsForMessage));
      } catch (error) {
        console.error("Failed to fetch replies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReplies();

    // Listen for new replies
    const handleNewReply = async (data: {
      reply: Message | DirectMessage;
      parentMessage: (Message | DirectMessage) & { replyCount: number };
    }) => {
      if (data.reply.parentId === parentMessage.id) {
        setReplies((prev) => [...prev, data.reply]);
        await fetchFileUrlsForMessage(data.reply);
      }
    };

    socket.on("new_reply", handleNewReply);

    return () => {
      socket.off("new_reply", handleNewReply);
    };
  }, [parentMessage.id]);

  const handleMessageSent = () => {
    // Optionally handle any post-send actions
  };

  const getUserInfo = (message: Message | DirectMessage) => {
    if ("user" in message) {
      return message.user;
    }
    return message.sender;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--background-light)] sticky top-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text)]">Thread</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[var(--background-hover)] rounded-lg transition-colors duration-200"
        >
          <X className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--text)]" />
        </button>
      </div>

      {/* Scrollable container for both parent message and replies */}
      <div className="flex-1 overflow-y-auto">
        {/* Parent Message */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--background-light)]">
          <div className="flex items-start space-x-3">
            <img
              src={
                userInfo.avatarUrl ||
                `https://ui-avatars.com/api/?name=${
                  userInfo.name || "User"
                }&background=random`
              }
              alt={userInfo.name || "User"}
              className="w-10 h-10 rounded-full border-2 border-[var(--border)]"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-[var(--text)] text-base">
                  {userInfo.name || userInfo.email}
                </span>
                <span className="text-sm text-[var(--text-muted)]">
                  {new Date(parentMessage.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {parentMessage.content && (
                <p className="text-base text-[var(--text)] mt-1 leading-relaxed break-words">
                  {parentMessage.content}
                </p>
              )}
              {"files" in parentMessage &&
                parentMessage.files &&
                parentMessage.files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {parentMessage.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex flex-col space-y-2 bg-[var(--background)] p-3 rounded"
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
                            <p className="text-base text-[var(--text)]">
                              {file.name}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            {fileUrls[file.id] && (
                              <a
                                href={fileUrls[file.id]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 text-base text-[var(--primary)] hover:brightness-110 transition-colors duration-200"
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
                              className="px-3 py-1.5 text-base text-[var(--primary)] hover:brightness-110 transition-colors duration-200"
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
            </div>
          </div>
        </div>

        {/* Replies */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
          ) : (
            replies.map((reply) => {
              const replyUserInfo = getUserInfo(reply);
              return (
                <div
                  key={reply.id}
                  className="flex items-start space-x-3 group hover:bg-[var(--background-hover)] p-2 rounded-lg transition-colors duration-200"
                >
                  <img
                    src={
                      replyUserInfo.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${
                        replyUserInfo.name || "User"
                      }&background=random`
                    }
                    alt={replyUserInfo.name || "User"}
                    className="w-8 h-8 rounded-full border border-[var(--border)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-[var(--text)] text-base">
                        {replyUserInfo.name || replyUserInfo.email}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">
                        {new Date(reply.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {reply.content && (
                      <p className="text-base text-[var(--text)] break-words leading-relaxed">
                        {reply.content}
                      </p>
                    )}
                    {"files" in reply &&
                      reply.files &&
                      reply.files.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {reply.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex flex-col space-y-2 bg-[var(--background-light)] p-3 rounded"
                            >
                              {fileUrls[file.id] &&
                                isPreviewable(file.type) &&
                                !previewErrors[file.id] && (
                                  <div className="max-w-md">
                                    <img
                                      src={fileUrls[file.id]}
                                      alt={file.name}
                                      className="rounded-md max-h-96 object-contain"
                                      onError={() =>
                                        handlePreviewError(file.id)
                                      }
                                    />
                                  </div>
                                )}
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-base text-[var(--text)]">
                                    {file.name}
                                  </p>
                                  <p className="text-sm text-[var(--text-muted)]">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                                <div className="flex space-x-2">
                                  {fileUrls[file.id] && (
                                    <a
                                      href={fileUrls[file.id]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 text-base text-[var(--primary)] hover:brightness-110 transition-colors duration-200"
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
                                    className="px-3 py-1.5 text-base text-[var(--primary)] hover:brightness-110 transition-colors duration-200"
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-[var(--border)] sticky bottom-0 bg-[var(--background)]">
        <MessageInput
          parentId={parentMessage.id}
          channelId={
            "channelId" in parentMessage ? parentMessage.channelId : undefined
          }
          dmUserId={
            "senderId" in parentMessage
              ? parentMessage.senderId === localStorage.getItem("userId")
                ? parentMessage.receiverId
                : parentMessage.senderId
              : undefined
          }
          onMessageSent={handleMessageSent}
          placeholder="Reply in thread..."
        />
      </div>
    </div>
  );
}
