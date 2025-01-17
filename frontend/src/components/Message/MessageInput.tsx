import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Sparkles } from "lucide-react";
import { socket } from "../../lib/socket";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import FilePreview from "./FilePreview";
import MentionPopup from "./MentionPopup";
import useMention from "../../hooks/useMention";
import { User } from "../../types/user";

interface Props {
  channelId?: string | null;
  dmUserId?: string | null;
  onMessageSent?: () => void;
  parentId?: string;
  placeholder?: string;
  users?: User[];
}

// AI suggestion response shape
type AISuggestionResponse = {
  suggestion?: string;
  choices?: Array<{ message: { content: string } }>;
  generation?: string;
  outputs?: Array<{ text: string }>;
  completion?: string;
};

export default function MessageInput({
  channelId,
  dmUserId,
  onMessageSent,
  parentId,
  placeholder = "Type a message...",
  users = [],
}: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize mention functionality
  const {
    showPopup,
    searchTerm,
    selectedIndex,
    position,
    filteredUsers,
    handleMentionTrigger,
    handleKeyDown: handleMentionKeyDown,
    handleSelect: handleMentionSelect,
    closePopup,
  } = useMention({
    users,
    inputRef,
    setMessage,
  });

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setSelectedFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit triggered", {
      hasMessage: !!message.trim(),
      hasFiles: selectedFiles.length > 0,
      isSending: sending,
      channelId,
      dmUserId,
      selectedFiles: selectedFiles.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
    });

    if ((!message.trim() && selectedFiles.length === 0) || sending) {
      console.log("Submit cancelled:", {
        reason:
          !message.trim() && selectedFiles.length === 0
            ? "no content"
            : "already sending",
        message: message,
        selectedFiles: selectedFiles.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        sending,
      });
      return;
    }

    setSending(true);
    try {
      // Handle file uploads first
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          await uploadSingleFile(file, message);
        }
      } else {
        // Send text-only message
        if (channelId) {
          socket.emit("send_message", {
            content: message,
            channelId,
            parentId,
          });
        } else if (dmUserId) {
          socket.emit("send_dm", {
            content: message,
            receiverId: dmUserId,
            parentId,
          });
        }
      }

      setMessage("");
      setSelectedFiles([]);
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

  const uploadSingleFile = async (file: File, content: string) => {
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    console.log("Starting file upload process:", {
      fileName,
      fileType,
      fileSize,
      channelId,
      dmUserId,
      API_ENDPOINT: API_CONFIG.ENDPOINTS.FILES.UPLOAD_URL,
    });

    // Step 1: Get presigned upload URL
    console.log("Requesting upload URL...", {
      fileName,
      fileType,
      channelId,
      dmUserId,
      messageContent: content,
    });

    const uploadPayload: {
      fileName: string;
      fileType: string;
      content: string;
      parentId?: string;
      channelId?: string;
      dmUserId?: string;
    } = {
      fileName,
      fileType,
      content,
      parentId,
    };
    if (channelId) uploadPayload.channelId = channelId;
    if (dmUserId) uploadPayload.dmUserId = dmUserId;

    try {
      const uploadResponse = await axiosInstance.post(
        API_CONFIG.ENDPOINTS.FILES.UPLOAD_URL,
        uploadPayload
      );
      console.log("Received upload URL response:", {
        ...uploadResponse.data,
        isThread: !!parentId,
      });

      // Step 2: Upload file to S3
      console.log("Starting S3 upload...");
      console.log("S3 Upload Request Details:", {
        url: uploadResponse.data.uploadUrl,
        method: "PUT",
        contentType: fileType,
        fileSize,
        fileName,
      });

      const { uploadUrl, file: fileData, messageId } = uploadResponse.data;

      try {
        console.log(
          "Making S3 request with URL:",
          uploadResponse.data.uploadUrl
        );

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", fileType);
          xhr.withCredentials = false;

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(null);
            } else {
              reject(`Failed to upload file to S3: ${xhr.statusText}`);
            }
          };
          xhr.onerror = () => reject("Network error during S3 upload");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              console.log(`Upload progress: ${percentComplete}%`);
            }
          };

          xhr.send(file);
        });

        console.log("Upload completed successfully");

        // Step 3: Notify backend about completion
        const fileUploadData: {
          fileId: string;
          size: number;
          messageId: string;
          parentId?: string;
          channelId?: string;
          dmUserId?: string;
        } = {
          fileId: fileData.id,
          size: fileSize,
          messageId,
          parentId,
        };
        if (channelId) fileUploadData.channelId = channelId;
        if (dmUserId) fileUploadData.dmUserId = dmUserId;

        console.log("Emitting file_upload_complete with data:", fileUploadData);
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);
    handleMentionTrigger(newValue, e.target.selectionStart || 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopup) {
      // Prevent form submission when selecting a mention with Enter
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
      }
      handleMentionKeyDown(e);
      return;
    }

    // Handle normal message submission with Enter (without shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && (message.trim() || selectedFiles.length > 0)) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* File Preview Section */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, idx) => (
            <FilePreview
              key={`${file.name}-${idx}`}
              file={file}
              onRemove={handleRemoveFile}
            />
          ))}
        </div>
      )}

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

        <textarea
          ref={inputRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 p-2 bg-transparent text-[var(--text)] text-base placeholder-[var(--text-muted)] focus:outline-none resize-none"
          style={{
            minHeight: "40px",
            maxHeight: "120px",
          }}
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
            disabled={
              (!message.trim() && selectedFiles.length === 0) || sending
            }
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              (message.trim() || selectedFiles.length > 0) && !sending
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
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
      </form>

      {/* Mention Popup */}
      {showPopup && (
        <MentionPopup
          users={filteredUsers}
          searchTerm={searchTerm}
          selectedIndex={selectedIndex}
          position={position}
          onSelect={handleMentionSelect}
          onClose={closePopup}
        />
      )}

      {/* AI Suggestions Section */}
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
