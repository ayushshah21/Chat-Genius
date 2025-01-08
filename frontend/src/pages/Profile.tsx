import { useState, useEffect } from "react";
import { User } from "../types/user";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.USER.PROFILE
        );
        setUser(response.data);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#1A1D21]">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-300 hover:text-white flex items-center space-x-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="bg-[#222529] rounded-lg p-6 shadow-lg border border-gray-700">
          <div className="flex items-center space-x-4">
            <img
              src={
                user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${
                  user?.name || "User"
                }&background=random`
              }
              alt={user?.name || "User"}
              className="w-20 h-20 rounded-full border-2 border-gray-700"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">
                {user?.name || "User"}
              </h1>
              <p className="text-gray-400">{user?.email}</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Profile Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Status
                </label>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      user?.status === "online" ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                  <span className="text-gray-300 capitalize">
                    {user?.status || "offline"}
                  </span>
                </div>
              </div>
              {/* Add more profile settings here */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
