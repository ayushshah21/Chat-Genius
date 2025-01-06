import { useEffect, useState } from "react";
import { Channel } from "../../types/channel";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { Plus, Hash, Lock } from "lucide-react";

interface Props {
  onCreateChannel: () => void;
}

export default function ChannelList({ onCreateChannel }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.CHANNELS.LIST
        );
        setChannels(response.data);
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Channels</h2>
        <button
          onClick={onCreateChannel}
          className="p-1 hover:bg-gray-100 rounded-md"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {channels.map((channel) => (
          <ChannelItem key={channel.id} channel={channel} />
        ))}
      </div>
    </div>
  );
}

function ChannelItem({ channel }: { channel: Channel }) {
  return (
    <div className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer group">
      {channel.type === "PRIVATE" ? (
        <Lock className="w-4 h-4 mr-2 text-gray-500" />
      ) : (
        <Hash className="w-4 h-4 mr-2 text-gray-500" />
      )}
      <span className="flex-1 truncate">{channel.name}</span>
      {channel._count && (
        <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100">
          {channel._count.messages}
        </span>
      )}
    </div>
  );
}
