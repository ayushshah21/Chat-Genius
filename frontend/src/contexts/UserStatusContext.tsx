import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types/user";
import { socket } from "../lib/socket";

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
    // Listen for user status updates
    socket.on("user.status", (user: User) => {
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
