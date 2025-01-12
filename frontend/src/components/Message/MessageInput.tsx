import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Sparkles } from "lucide-react";
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

// Add type definition for AI suggestion response
type AISuggestionResponse = {
  suggestion?: string;
  originalContent?: string;
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  generation?: string;
  outputs?: Array<{
    text: string;
  }>;
  completion?: string;
};

export default function MessageInput({
  channelId,
  dmUserId,
  onMessageSent,
  parentId,
  placeholder = "Type a message...",
}: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    socket.on("ai_suggestion", (response: AISuggestionResponse) => {
      console.log("Received AI suggestion:", response);
      const suggestion =
        response.suggestion ||
        response.choices?.[0]?.message?.content ||
        response.generation ||
        response.outputs?.[0]?.text ||
        response.completion;

      if (suggestion) {
        setSuggestions([suggestion]);
      }
      setLoadingSuggestions(false);
    });

    socket.on("suggestion_error", (error: string) => {
      console.error("Error getting suggestions:", error);
      setLoadingSuggestions(false);
    });

    return () => {
      socket.off("ai_suggestion");
      socket.off("suggestion_error");
    };
  }, []);

  const requestSuggestions = () => {
    if (loadingSuggestions) return;

    setLoadingSuggestions(true);
    setSuggestions([]);

    socket.emit("request_ai_suggestion", {
      channelId,
      dmUserId,
      parentId,
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit triggered", {
      hasMessage: !!message.trim(),
      hasFile: !!selectedFile,
      isSending: sending,
      channelId,
      dmUserId,
      selectedFile: selectedFile
        ? {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
          }
        : null,
    });

    if ((!message.trim() && !selectedFile) || sending) {
      console.log("Submit cancelled:", {
        reason:
          !message.trim() && !selectedFile ? "no content" : "already sending",
        message: message,
        selectedFile: selectedFile
          ? {
              name: selectedFile.name,
              type: selectedFile.type,
              size: selectedFile.size,
            }
          : null,
        sending,
      });
      return;
    }

    setSending(true);
    try {
      if (channelId) {
        if (selectedFile) {
          console.log("Starting file upload process:", {
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            channelId,
            API_ENDPOINT: API_CONFIG.ENDPOINTS.FILES.UPLOAD_URL,
          });

          // Get upload URL first
          console.log("Requesting upload URL...", {
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            channelId,
            dmUserId,
            messageContent: message,
          });
          try {
            const uploadResponse = await axiosInstance.post(
              API_CONFIG.ENDPOINTS.FILES.UPLOAD_URL,
              {
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                channelId,
                content: message,
                parentId,
              }
            );
            console.log("Received upload URL response:", {
              ...uploadResponse.data,
              isThread: !!parentId,
            });

            // Upload file to S3
            console.log("Starting S3 upload...");
            console.log("S3 Upload Request Details:", {
              url: uploadResponse.data.uploadUrl,
              method: "PUT",
              contentType: selectedFile.type,
              fileSize: selectedFile.size,
              fileName: selectedFile.name,
            });

            try {
              console.log(
                "Making S3 request with URL:",
                uploadResponse.data.uploadUrl
              );

              // Use XMLHttpRequest instead of fetch
              const uploadPromise = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadResponse.data.uploadUrl);

                // Set headers before sending
                xhr.setRequestHeader("Content-Type", selectedFile.type);
                xhr.withCredentials = false; // Important for S3

                xhr.onload = function () {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                      ok: true,
                      status: xhr.status,
                      statusText: xhr.statusText,
                    });
                  } else {
                    reject(
                      new Error(
                        `Upload failed with status ${xhr.status}: ${xhr.responseText}`
                      )
                    );
                  }
                };

                xhr.onerror = function (e) {
                  console.error("XHR Error:", e);
                  reject(new Error("Network error occurred during upload"));
                };

                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    console.log(`Upload progress: ${percentComplete}%`);
                  }
                };

                xhr.send(selectedFile);
              });

              await uploadPromise;
              console.log("Upload completed successfully");

              // Notify about file upload completion
              const fileUploadData = {
                channelId,
                fileId: uploadResponse.data.file.id,
                messageId: uploadResponse.data.messageId,
                size: selectedFile.size,
                parentId,
              };
              console.log(
                "Emitting file_upload_complete with data:",
                fileUploadData
              );
              socket.emit("file_upload_complete", fileUploadData);
            } catch (uploadError) {
              console.error("Upload process failed:", uploadError);
              if (uploadError instanceof Error) {
                console.error("Upload error details:", {
                  name: uploadError.name,
                  message: uploadError.message,
                  stack: uploadError.stack,
                });
              }
              throw uploadError;
            }
          } catch (uploadError) {
            console.error("Upload process failed:", uploadError);
            if (uploadError instanceof Error) {
              console.error("Upload error details:", {
                name: uploadError.name,
                message: uploadError.message,
                stack: uploadError.stack,
              });
            }
            throw uploadError;
          }
        } else {
          // Send text-only message
          socket.emit("send_message", {
            content: message,
            channelId,
            parentId,
          });
        }
      } else if (dmUserId) {
        if (selectedFile) {
          console.log("Starting file upload process for DM:", {
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            dmUserId,
            parentId,
            API_ENDPOINT: API_CONFIG.ENDPOINTS.FILES.UPLOAD_URL,
          });

          // Get upload URL first
          console.log("Requesting upload URL...");
          try {
            const uploadResponse = await axiosInstance.post(
              API_CONFIG.ENDPOINTS.FILES.UPLOAD_URL,
              {
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                dmUserId,
                parentId,
                content: message,
              }
            );
            console.log(
              "Received upload URL response for DM:",
              uploadResponse.data
            );

            // Upload file to S3
            console.log("Starting S3 upload...");
            console.log("S3 Upload Request Details:", {
              url: uploadResponse.data.uploadUrl,
              method: "PUT",
              contentType: selectedFile.type,
              fileSize: selectedFile.size,
              fileName: selectedFile.name,
            });

            try {
              console.log(
                "Making S3 request with URL:",
                uploadResponse.data.uploadUrl
              );

              // Use XMLHttpRequest instead of fetch
              const uploadPromise = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadResponse.data.uploadUrl);

                // Set headers before sending
                xhr.setRequestHeader("Content-Type", selectedFile.type);
                xhr.withCredentials = false; // Important for S3

                xhr.onload = function () {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                      ok: true,
                      status: xhr.status,
                      statusText: xhr.statusText,
                    });
                  } else {
                    reject(
                      new Error(
                        `Upload failed with status ${xhr.status}: ${xhr.responseText}`
                      )
                    );
                  }
                };

                xhr.onerror = function (e) {
                  console.error("XHR Error:", e);
                  reject(new Error("Network error occurred during upload"));
                };

                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    console.log(`Upload progress: ${percentComplete}%`);
                  }
                };

                xhr.send(selectedFile);
              });

              await uploadPromise;
              console.log("Upload completed successfully");

              // Notify about file upload completion
              const fileUploadData = {
                dmUserId,
                fileId: uploadResponse.data.file.id,
                messageId: uploadResponse.data.messageId,
                size: selectedFile.size,
                parentId,
              };
              console.log(
                "Emitting file_upload_complete with data:",
                fileUploadData
              );
              socket.emit("file_upload_complete", fileUploadData);
            } catch (uploadError) {
              console.error("Upload process failed:", uploadError);
              if (uploadError instanceof Error) {
                console.error("Upload error details:", {
                  name: uploadError.name,
                  message: uploadError.message,
                  stack: uploadError.stack,
                });
              }
              throw uploadError;
            }
          } catch (uploadError) {
            console.error("Upload process failed:", uploadError);
            if (uploadError instanceof Error) {
              console.error("Upload error details:", {
                name: uploadError.name,
                message: uploadError.message,
                stack: uploadError.stack,
              });
            }
            throw uploadError;
          }
        } else {
          // Send text-only DM
          console.log(message + " " + dmUserId + " " + parentId);
          socket.emit("send_dm", {
            content: message,
            receiverId: dmUserId,
            parentId,
          });
        }
      }

      setMessage("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onMessageSent?.();
    } catch (error) {
      console.error("Failed to send message:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 w-full bg-[var(--background-light)] p-2 rounded-lg border border-[var(--border)] focus-within:ring-1 focus-within:ring-[var(--primary)] transition-shadow duration-200"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-[var(--background-hover)] rounded-lg transition-colors duration-200"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--text)]" />
        </button>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          className="flex-1 p-2 bg-transparent text-[var(--text)] text-base placeholder-[var(--text-muted)] focus:outline-none"
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={requestSuggestions}
            disabled={loadingSuggestions}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              !loadingSuggestions
                ? "hover:bg-[var(--background-hover)] text-[var(--primary)]"
                : "opacity-50 cursor-not-allowed text-[var(--text-muted)]"
            }`}
            title="Get AI suggestions based on chat history"
          >
            <Sparkles className="w-5.5 h-5.5" />
          </button>

          <button
            type="submit"
            disabled={(!message.trim() && !selectedFile) || sending}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              (message.trim() || selectedFile) && !sending
                ? "hover:bg-[var(--background-hover)] text-[var(--primary)]"
                : "opacity-50 cursor-not-allowed text-[var(--text-muted)]"
            }`}
          >
            <Send className="w-5.5 h-5.5" />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setSelectedFile(file);
          }}
          className="hidden"
        />
      </form>

      {loadingSuggestions && (
        <div className="mt-3 text-base text-[var(--text-muted)] flex items-center gap-2 px-2">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--primary)] border-t-transparent"></div>
          Generating suggestions...
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="block w-full text-left p-3.5 text-base text-[var(--text)] bg-[var(--background-light)] hover:bg-[var(--background-hover)] rounded-lg border border-[var(--border)] transition-colors duration-200 hover:border-[var(--primary)]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
