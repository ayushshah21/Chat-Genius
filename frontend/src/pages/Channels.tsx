import { useState, useEffect } from "react";
import ChannelList from "../components/Channel/ChannelList";
import CreateChannelModal from "../components/Channel/CreateChannelModal";
import MessageList from "../components/Message/MessageList";
import MessageInput from "../components/Message/MessageInput";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";
import { Channel } from "../types/channel";
import { Menu, X } from "lucide-react";
import { socket } from "../lib/socket";
import { User } from "../types/user";

export default function Channels() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    console.log("Channels: Component mounted");

    const fetchChannels = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.CHANNELS.LIST
        );
        console.log("Channels: Fetched initial channels:", response.data);
        setChannels(response.data);
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      }
    };
    fetchChannels();

    // Listen for new channels
    socket.on("new_channel", (channel: Channel) => {
      console.log("Channels: Received new_channel event:", channel);
      setChannels((prev) => {
        console.log("Channels: Updating state with new channel");
        return [...prev, channel];
      });
    });

    return () => {
      console.log("Channels: Cleaning up socket listener");
      socket.off("new_channel");
    };
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.USERS.AVAILABLE
        );
        setUsers(response.data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };
    fetchUsers();
  }, []);

  const handleDMSelect = async (userId: string) => {
    setSelectedChannel(null); // Deselect any channel
    setSelectedDMUser(userId);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transform transition-transform duration-300 ease-in-out fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg md:relative md:translate-x-0`}
      >
        <ChannelList
          channels={channels.filter((c) => c.type !== "DM")} // Only show regular channels
          onCreateChannel={() => setIsCreateModalOpen(true)}
          onChannelSelect={(channelId) => {
            setSelectedChannel(channelId);
            setSelectedDMUser(null); // Deselect any DM
          }}
          selectedChannelId={selectedChannel}
          onDirectMessageSelect={handleDMSelect}
          selectedDMUserId={selectedDMUser}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel/DM Header */}
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
              : selectedDMUser
              ? users.find((u) => u.id === selectedDMUser)?.name ||
                users.find((u) => u.id === selectedDMUser)?.email
              : "Select a conversation"}
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden bg-white">
          {selectedChannel || selectedDMUser ? (
            <MessageList
              channelId={selectedChannel}
              dmUserId={selectedDMUser}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a channel or user to start messaging
            </div>
          )}
        </div>

        {/* Message Input */}
        {(selectedChannel || selectedDMUser) && (
          <div className="bg-white border-t border-gray-200">
            <MessageInput
              channelId={selectedChannel}
              dmUserId={selectedDMUser}
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
        }}
      />
    </div>
  );
}
