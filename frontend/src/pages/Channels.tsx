import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import ChannelList from "../components/Channel/ChannelList";
import MessageList from "../components/Message/MessageList";
import Navbar from "../components/Navigation/Navbar";
import { Channel } from "../types/channel";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";

export default function Channels() {
  const { channelId, userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const messageId = searchParams.get("messageId");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  // Clear messageId from URL after initial highlight
  useEffect(() => {
    if (messageId) {
      const timer = setTimeout(() => {
        // Remove messageId from URL without navigating
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("messageId");
        setSearchParams(newParams, { replace: true });
      }, 2000); // Match the highlight duration

      return () => clearTimeout(timer);
    }
  }, [messageId, searchParams, setSearchParams]);

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

  useEffect(() => {
    fetchChannels();
  }, [channelId, userId, navigate]);

  const handleChannelCreated = async (newChannelId: string) => {
    await fetchChannels();
    navigate(`/channels/${newChannelId}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Overlay for mobile when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`absolute md:relative w-64 bg-[var(--sidebar-bg)] flex flex-col h-full z-30 
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:translate-x-0`}
        >
          <div className="flex-1 overflow-y-auto">
            <ChannelList
              channels={channels}
              selectedChannelId={channelId}
              selectedUserId={userId}
              onChannelCreated={handleChannelCreated}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-[var(--background)] overflow-hidden">
          <MessageList
            channelId={channelId}
            dmUserId={userId}
            highlightMessageId={messageId}
          />
        </div>
      </div>
    </div>
  );
}
