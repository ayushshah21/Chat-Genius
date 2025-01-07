import { useState, useEffect } from "react";
import ChannelList from "../components/Channel/ChannelList";
import CreateChannelModal from "../components/Channel/CreateChannelModal";
import MessageList from "../components/Message/MessageList";
import MessageInput from "../components/Message/MessageInput";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";
import { Channel } from "../types/channel";
import { Menu, X } from 'lucide-react';

export default function Channels() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.CHANNELS.LIST
        );
        setChannels(response.data);
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      }
    };
    fetchChannels();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transform transition-transform duration-300 ease-in-out fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg md:relative md:translate-x-0`}
      >
        <ChannelList
          channels={channels}
          onCreateChannel={() => setIsCreateModalOpen(true)}
          onChannelSelect={setSelectedChannel}
          selectedChannelId={selectedChannel}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="h-16 bg-white shadow-sm flex items-center px-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mr-4 text-gray-500 hover:text-gray-700 md:hidden"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h2 className="font-semibold text-lg text-gray-800">
            {selectedChannel
              ? `# ${channels.find((c) => c.id === selectedChannel)?.name}`
              : "Select a channel"}
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden bg-white">
          {selectedChannel ? (
            <MessageList channelId={selectedChannel} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a channel to start messaging
            </div>
          )}
        </div>

        {/* Message Input */}
        {selectedChannel && (
          <div className="bg-white border-t border-gray-200">
            <MessageInput
              channelId={selectedChannel}
              onMessageSent={() => {
                // Optionally refresh messages or handle via WebSocket
              }}
            />
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onChannelCreated={() => {
          setIsCreateModalOpen(false);
          // Refresh channels list
        }}
      />
    </div>
  );
}
