import React from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";

const Navbar: React.FC<{ userEmail: string }> = ({ userEmail }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    socket.emit("update_status", "offline");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav className="bg-blue-500 p-4 flex justify-between items-center">
      <div className="text-white font-bold">Welcome, {userEmail}</div>
      <button
        onClick={handleLogout}
        className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
      >
        Logout
      </button>
    </nav>
  );
};

export default Navbar;
