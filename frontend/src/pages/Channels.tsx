import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChannelList from "../components/Channel/ChannelList";
import MessageList from "../components/Message/MessageList";
import { Channel } from "../types/channel";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";

export default function Channels() {
  const { channelId, userId } = useParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.CHANNELS.LIST
        );
        setChannels(response.data);

        // If no channel or user is selected, select the first channel
        if (!channelId && !userId && response.data.length > 0) {
          navigate(`/channels/${response.data[0].id}`);
        }
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [channelId, userId, navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-[#19171D] flex flex-col">
        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          <ChannelList
            channels={channels}
            selectedChannelId={channelId}
            selectedUserId={userId}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[#1A1D21]">
        <MessageList channelId={channelId} dmUserId={userId} />
      </div>
    </div>
  );
}
