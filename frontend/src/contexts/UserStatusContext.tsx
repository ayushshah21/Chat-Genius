import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types/user";
import { socket, initSocket } from "../lib/socket";
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";

interface UserStatusContextType {
  userStatuses: Record<string, string>;
  updateUserStatus: (userId: string, status: string) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  setIsAuthenticated: (value: boolean) => void;
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateTokenAndInitialize = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoading(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await axiosInstance.get(
          API_CONFIG.ENDPOINTS.AUTH.PROTECTED
        );
        if (response.data.user) {
          setIsAuthenticated(true);
          // Initialize socket only if not already connected
          if (!socket.connected) {
            initSocket(token);
            // Fetch initial user statuses
            const statusResponse = await axiosInstance.get(
              API_CONFIG.ENDPOINTS.USERS.AVAILABLE
            );
            const users = statusResponse.data;
            const initialStatuses: Record<string, string> = {};
            users.forEach((user: User) => {
              initialStatuses[user.id] = user.status;
            });
            setUserStatuses(initialStatuses);
          }
        } else {
          setIsAuthenticated(false);
          localStorage.clear();
        }
      } catch (error) {
        console.error("Token validation failed:", error);
        setIsAuthenticated(false);
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    validateTokenAndInitialize();

    // Set up socket event listeners
    const handleStatusUpdate = (user: User) => {
      console.log("[UserStatusContext] Received status update:", user);
      setUserStatuses((prev) => ({
        ...prev,
        [user.id]: user.status,
      }));
    };

    socket.on("user.status", handleStatusUpdate);

    return () => {
      socket.off("user.status", handleStatusUpdate);
    };
  }, []);

  const updateUserStatus = (userId: string, status: string) => {
    if (socket.connected) {
      socket.emit("update_status", status);
      setUserStatuses((prev) => ({
        ...prev,
        [userId]: status,
      }));
    }
  };

  return (
    <UserStatusContext.Provider
      value={{
        userStatuses,
        updateUserStatus,
        isAuthenticated,
        isLoading,
        setIsAuthenticated,
      }}
    >
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
