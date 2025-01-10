import { useState } from "react";
import { X } from "lucide-react";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { AxiosError } from "axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
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
      const response = await axiosInstance.post(
        API_CONFIG.ENDPOINTS.CHANNELS.CREATE,
        {
          name: channelName.trim(),
          type: isPrivate ? "PRIVATE" : "PUBLIC",
        }
      );
      onChannelCreated(response.data.id);
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      setError(axiosError.response?.data?.error || "Failed to create channel");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-md relative">
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-[var(--background-hover)] rounded-full transition-colors duration-200"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--text)]" />
          </button>

          <h2 className="text-2xl font-bold mb-6 text-[var(--text)]">
            Create a channel
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
                Channel name
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--input-bg)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent placeholder-[var(--text-muted)]"
                placeholder="e.g. project-updates"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center space-x-2 text-[var(--text-secondary)] text-sm font-medium">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-[var(--primary)] rounded border-[var(--border)] bg-[var(--input-bg)]"
                />
                <span>Make private</span>
              </label>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
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
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--background-hover)] rounded transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!channelName.trim() || isLoading}
                className="px-4 py-2 bg-[var(--primary)] text-[var(--text)] rounded hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
