import { useState, useEffect } from "react";
import { Channel } from "../../types/channel";
import { User } from "../../types/user";
import { Plus, Hash } from "lucide-react";
import CreateChannelModal from "./CreateChannelModal";
import { Link } from "react-router-dom";
import { useUserStatus } from "../../contexts/UserStatusContext";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";

interface Props {
  channels: Channel[];
  selectedChannelId?: string | null;
  selectedUserId?: string | null;
}

export default function ChannelList({
  channels,
  selectedChannelId,
  selectedUserId,
}: Props) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const { userStatuses } = useUserStatus();

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

  return (
    <div className="h-full bg-[#19171D] text-gray-100">
      <div className="p-4 border-b border-gray-700 bg-[#19171D]">
        <h2 className="text-lg font-semibold mb-4 text-white">Channels</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full px-4 py-2 text-white bg-[#007a5a] rounded hover:bg-[#148567] transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Create Channel</span>
        </button>
      </div>

      <div className="p-2 space-y-1">
        {channels.map((channel) => (
          <Link
            key={channel.id}
            to={`/channels/${channel.id}`}
            className={`flex items-center px-3 py-1.5 rounded hover:bg-[#222529] transition-colors duration-200 ${
              selectedChannelId === channel.id
                ? "bg-[#1164A3] text-white"
                : "text-gray-300"
            }`}
          >
            <Hash className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{channel.name}</span>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Direct Messages
        </h2>
        <div className="space-y-1">
          {users.map((user) => (
            <Link
              key={user.id}
              to={`/dm/${user.id}`}
              className={`flex items-center px-3 py-1.5 rounded hover:bg-[#222529] transition-colors duration-200 ${
                selectedUserId === user.id
                  ? "bg-[#1164A3] text-white"
                  : "text-gray-300"
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={
                    user.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${
                      user.name || "User"
                    }&background=random`
                  }
                  alt={user.name || "User"}
                  className="w-6 h-6 rounded-full"
                />
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#19171D] ${
                    userStatuses[user.id] === "online"
                      ? "bg-green-500"
                      : "bg-gray-500"
                  }`}
                />
              </div>
              <span className="ml-2 truncate">{user.name || user.email}</span>
            </Link>
          ))}
        </div>
      </div>

      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onChannelCreated={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
