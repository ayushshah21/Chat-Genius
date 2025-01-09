import { useState, useRef } from "react";
import { Send, Paperclip } from "lucide-react";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              url: uploadResponse.data.url,
              method: "PUT",
              contentType: selectedFile.type,
              fileSize: selectedFile.size,
              fileName: selectedFile.name,
            });

            try {
              console.log(
                "Making S3 request with URL:",
                uploadResponse.data.url
              );

              // Use XMLHttpRequest instead of fetch
              const uploadPromise = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadResponse.data.url);

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
                fileId: uploadResponse.data.id,
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
              url: uploadResponse.data.url,
              method: "PUT",
              contentType: selectedFile.type,
              fileSize: selectedFile.size,
              fileName: selectedFile.name,
            });

            try {
              console.log(
                "Making S3 request with URL:",
                uploadResponse.data.url
              );

              // Use XMLHttpRequest instead of fetch
              const uploadPromise = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadResponse.data.url);

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
                fileId: uploadResponse.data.id,
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

  const handleFileClick = () => {
    console.log("File input click triggered");
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input change event:", e);
    console.log("File input files:", e.target.files);
    const file = e.target.files?.[0];
    if (file) {
      // Only allow files up to 10MB
      if (file.size > 10 * 1024 * 1024) {
        console.log("File too large:", file.size);
        alert("File size must be less than 10MB");
        return;
      }
      console.log("File selected:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      setSelectedFile(file);
    } else {
      console.log("No file selected");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={!isThread ? "p-4" : undefined}>
      <div className="flex flex-col space-y-2">
        {selectedFile && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-gray-700 rounded-md">
            <span className="text-sm text-gray-300">{selectedFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="text-gray-400 hover:text-gray-300"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleFileClick}
            className="p-2 text-gray-400 hover:text-gray-300 transition-colors duration-200"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-4 py-2 bg-[#222529] text-white border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-shadow duration-200"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || (!message.trim() && !selectedFile)}
            className="p-2 text-white bg-[#007a5a] rounded-full hover:bg-[#148567] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </form>
  );
}
