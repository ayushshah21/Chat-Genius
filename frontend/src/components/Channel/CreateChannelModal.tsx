import { useState } from "react";
import { X } from "lucide-react";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { AxiosError } from "axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: () => void;
}

interface ErrorResponse {
  error: string;
}

export default function CreateChannelModal({
  isOpen,
  onClose,
  onChannelCreated,
}: Props) {
  const [channelName, setChannelName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      await axiosInstance.post(API_CONFIG.ENDPOINTS.CHANNELS.CREATE, {
        name: channelName.trim(),
        type: isPrivate ? "PRIVATE" : "PUBLIC",
      });
      onChannelCreated();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      setError(axiosError.response?.data?.error || "Failed to create channel");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1A1D21] rounded-lg shadow-xl w-full max-w-md relative">
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-gray-700 rounded-full transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>

          <h2 className="text-2xl font-bold mb-6 text-white">
            Create a channel
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Channel name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full px-4 py-2 bg-[#222529] text-white border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                placeholder="e.g. project-updates"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center space-x-2 text-gray-300 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-700 bg-[#222529]"
                />
                <span>Make private</span>
              </label>
              <p className="mt-1 text-sm text-gray-400">
                Private channels are only visible to their members
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!channelName.trim() || isLoading}
                className="px-4 py-2 bg-[#007a5a] text-white rounded hover:bg-[#148567] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
