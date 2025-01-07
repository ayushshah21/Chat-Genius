import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types/user";
import { socket } from "../lib/socket";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";

interface UserStatusContextType {
  userStatuses: Record<string, string>;
  updateUserStatus: (userId: string, status: string) => void;
}

const UserStatusContext = createContext<UserStatusContextType | undefined>(
  undefined
);

export function UserStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userStatuses, setUserStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch initial user statuses
    const fetchInitialStatuses = async () => {
      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.USERS.AVAILABLE
        );
        const users = response.data;
        const initialStatuses: Record<string, string> = {};
        users.forEach((user: User) => {
          initialStatuses[user.id] = user.status;
        });
        setUserStatuses(initialStatuses);
      } catch (error) {
        console.error("Failed to fetch initial user statuses:", error);
      }
    };

    fetchInitialStatuses();

    // Listen for user status updates
    socket.on("user.status", (user: User) => {
      console.log("[UserStatusContext] Received status update:", user);
      setUserStatuses((prev) => ({
        ...prev,
        [user.id]: user.status,
      }));
    });

    return () => {
      socket.off("user.status");
    };
  }, []);

  const updateUserStatus = (userId: string, status: string) => {
    socket.emit("update_status", status);
    setUserStatuses((prev) => ({
      ...prev,
      [userId]: status,
    }));
  };

  return (
    <UserStatusContext.Provider value={{ userStatuses, updateUserStatus }}>
      {children}
    </UserStatusContext.Provider>
  );
}

export function useUserStatus() {
  const context = useContext(UserStatusContext);
  if (context === undefined) {
    throw new Error("useUserStatus must be used within a UserStatusProvider");
  }
  return context;
}
