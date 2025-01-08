import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DirectMessagesList from "../components/DirectMessages/DirectMessagesList";
import DirectMessageChat from "../components/DirectMessages/DirectMessageChat";

export default function Messages() {
  const { userId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) {
      // If no userId is selected, redirect to the first available user
      navigate("/channels");
    }
  }, [userId, navigate]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r">
        <DirectMessagesList selectedUserId={userId} />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {userId ? (
          <DirectMessageChat />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a user to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
