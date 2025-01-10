import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { socket } from "../../lib/socket";

interface DeleteButtonProps {
  messageId: string;
  channelId?: string;
  isDM: boolean;
  isAuthor: boolean;
  onDelete?: () => void;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({
  messageId,
  channelId,
  isDM,
  isAuthor,
  onDelete,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isAuthor) return null;

  const handleDelete = async () => {
    try {
      console.log("[DeleteButton] Emitting delete_message:", {
        messageId,
        channelId,
        isDM,
      });

      socket.emit("delete_message", {
        messageId,
        channelId,
        isDM,
      });

      console.log("[DeleteButton] Emitted delete_message event");

      if (isDM && onDelete) {
        onDelete();
      }

      setShowConfirm(false);
    } catch (error) {
      console.error("[DeleteButton] Error deleting message:", error);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          console.log(
            "[DeleteButton] Delete button clicked for message:",
            messageId
          );
          setShowConfirm(true);
        }}
        className="p-1 text-gray-400 hover:text-red-500 transition-colors duration-200"
        title="Delete message"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1D21] rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-white mb-4">
              Delete Message
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this message? This action cannot
              be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
