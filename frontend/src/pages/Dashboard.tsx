import { useState } from "react";
import ChannelList from "../components/Channel/ChannelList";
import CreateChannelModal from "../components/Channel/CreateChannelModal";

export default function Dashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r bg-gray-50">
        <ChannelList onCreateChannel={() => setIsCreateModalOpen(true)} />
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Channel content will go here */}
        <div className="p-6">
          <h2 className="text-2xl font-bold">Welcome to ChatGenius</h2>
          <p className="text-gray-600">Select a channel to start chatting</p>
        </div>
      </div>

      {/* Modals */}
      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onChannelCreated={() => {
          // Refresh channel list
          window.location.reload();
        }}
      />
    </div>
  );
}
