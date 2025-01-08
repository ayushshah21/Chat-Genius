import { useState, useEffect } from "react";
import { User } from "../../types/user";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { UserCircle } from "lucide-react";
import { useUserStatus } from "../../contexts/UserStatusContext";
import { useNavigate } from "react-router-dom";

interface Props {
  onUserSelect?: (userId: string) => void;
  selectedUserId?: string | null;
}

export default function DirectMessagesList({
  onUserSelect,
  selectedUserId,
}: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { userStatuses } = useUserStatus();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.USERS.AVAILABLE
        );
        setUsers(response.data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleUserClick = async (userId: string, userName: string) => {
    console.log("DirectMessagesList: User clicked:", { userId, userName });

    try {
      // Navigate to DM chat with this user
      navigate(`/messages/${userId}`);
      onUserSelect?.(userId);
    } catch (error) {
      console.error("DirectMessagesList: Failed to handle DM:", error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <div className="flex flex-col space-y-1">
      <h3 className="px-4 text-sm font-semibold text-gray-500">
        DIRECT MESSAGES
      </h3>
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => handleUserClick(user.id, user.name || user.email)}
          className={`flex items-center px-4 py-2 rounded-md transition-colors duration-200 ${
            selectedUserId === user.id
              ? "bg-blue-100 text-blue-800"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl || undefined}
              alt={user.name || "User"}
              className="w-8 h-8 rounded-full mr-2"
            />
          ) : (
            <UserCircle className="w-8 h-8 text-gray-400 mr-2" />
          )}
          <span className="text-sm text-gray-700">
            {user.name ? user.name : user.email}
          </span>
          <span
            className={`ml-2 w-2 h-2 rounded-full ${
              userStatuses[user.id] === "online"
                ? "bg-green-500"
                : userStatuses[user.id] === "away"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            title={userStatuses[user.id] || "offline"}
          />
        </button>
      ))}
    </div>
  );
}
