import { useEffect, useState } from "react";
import { Channel } from "../../types/channel";
import { Plus, Hash, Lock } from "lucide-react";
import DirectMessagesList from "../DirectMessages/DirectMessagesList";

interface Props {
  channels: Channel[];
  onCreateChannel: () => void;
  onChannelSelect: (channelId: string) => void;
  selectedChannelId: string | null;
  onDirectMessageSelect: (userId: string) => void;
  selectedDMUserId: string | null;
}

export default function ChannelList({
  channels,
  onCreateChannel,
  onChannelSelect,
  selectedChannelId,
  onDirectMessageSelect,
}: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [channels]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  console.log("ChannelList: Rendering with channels:", channels);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Channels</h2>
        <button
          onClick={onCreateChannel}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mb-4">
          {channels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isSelected={channel.id === selectedChannelId}
              onSelect={onChannelSelect}
            />
          ))}
        </div>

        <DirectMessagesList
          onUserSelect={(userId) => {
            console.log(
              "ChannelList: Forwarding DM user selection to parent:",
              userId
            );
            onDirectMessageSelect(userId);
          }}
        />
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  isSelected,
  onSelect,
}: {
  channel: Channel;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(channel.id)}
      className={`flex items-center px-4 py-2 cursor-pointer group transition-colors duration-200 ${
        isSelected
          ? "bg-blue-100 text-blue-800"
          : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      {channel.type === "PRIVATE" ? (
        <Lock className="w-4 h-4 mr-2 text-gray-400" />
      ) : (
        <Hash className="w-4 h-4 mr-2 text-gray-400" />
      )}
      <span className="flex-1 truncate">{channel.name}</span>
      {channel._count && (
        <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {channel._count.messages}
        </span>
      )}
    </div>
  );
}
