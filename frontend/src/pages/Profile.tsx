import { useState, useEffect } from "react";
import { User } from "../types/user";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Save, X } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    avatarUrl: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.USER.PROFILE
        );
        setUser(response.data);
        setEditForm({
          name: response.data.name || "",
          email: response.data.email || "",
          avatarUrl: response.data.avatarUrl || "",
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await axiosInstance.put(
        API_CONFIG.ENDPOINTS.USER.UPDATE,
        editForm
      );
      setUser(response.data);
      setIsEditing(false);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Failed to update profile");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      name: user?.name || "",
      email: user?.email || "",
      avatarUrl: user?.avatarUrl || "",
    });
    setError("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1D21] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
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
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded text-red-500">
              {error}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="flex items-center space-x-4">
                <img
                  src={
                    editForm.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${
                      editForm.name || "User"
                    }&background=random`
                  }
                  alt={editForm.name || "User"}
                  className="w-20 h-20 rounded-full border-2 border-gray-700"
                />
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Avatar URL
                    </label>
                    <input
                      type="text"
                      value={editForm.avatarUrl}
                      onChange={(e) =>
                        setEditForm({ ...editForm, avatarUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#1A1D21] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter avatar URL"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#1A1D21] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#1A1D21] border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-300 hover:text-white flex items-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
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
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-gray-300 hover:text-white hover:bg-[#1A1D21] rounded-md transition-colors duration-200 flex items-center space-x-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Status
                  </label>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        user?.status === "online"
                          ? "bg-green-500"
                          : user?.status === "away"
                          ? "bg-yellow-500"
                          : "bg-gray-500"
                      }`}
                    />
                    <span className="text-gray-300 capitalize">
                      {user?.status || "offline"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Account Type
                  </label>
                  <p className="text-gray-300">
                    {user?.googleId ? "Google Account" : "Email Account"}
                  </p>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Member Since
                  </label>
                  <p className="text-gray-300">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
