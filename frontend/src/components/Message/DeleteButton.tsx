import { Trash2 } from "lucide-react";
import { socket } from "../../lib/socket";

interface DeleteButtonProps {
  messageId: string;
  channelId?: string;
  dmUserId?: string;
  isAuthor: boolean;
}

export function DeleteButton({
  messageId,
  channelId,
  dmUserId,
  isAuthor,
}: DeleteButtonProps) {
  const handleDelete = () => {
    if (!isAuthor) return;

    socket.emit("delete_message", {
      messageId,
      channelId,
      dmUserId,
    });
  };

  if (!isAuthor) return null;

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors duration-200"
      title="Delete message"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
