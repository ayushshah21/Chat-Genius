import { useState, useEffect, useRef } from "react";
import { Search, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { Message } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import { socket } from "../../lib/socket";

const themes = {
  default: "Default",
  beige: "Beige",
  dark: "Dark",
  slack: "Slack",
  ocean: "Ocean",
  forest: "Forest",
  sunset: "Sunset",
  midnight: "Midnight",
  coffee: "Coffee",
  lavender: "Lavender",
  mint: "Mint",
};

interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  type: "message" | "dm";
  channelId?: string;
  channelName?: string;
  senderId?: string;
  sender: {
    name: string | null;
    email: string;
  };
}

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [theme, setTheme] = useState("default");
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      // Emit logout event before clearing data
      socket.emit("logout");

      await axiosInstance.get(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
      localStorage.clear(); // Clear all local storage items
      socket.disconnect();
      navigate("/login");
    } catch (error) {
      console.error("Failed to logout:", error);
      // Still clear local data even if server logout fails
      localStorage.clear(); // Clear all local storage items
      socket.disconnect();
      navigate("/login");
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      const [messagesResponse, dmsResponse] = await Promise.all([
        axiosInstance.get(
          `${API_CONFIG.ENDPOINTS.SEARCH.MESSAGES}?query=${query}`
        ),
        axiosInstance.get(
          `${API_CONFIG.ENDPOINTS.SEARCH.DIRECT_MESSAGES}?query=${query}`
        ),
      ]);

      const messages: SearchResult[] = messagesResponse.data.map(
        (msg: Message) => ({
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
          type: "message",
          channelId: msg.channelId,
          channelName: msg.channel?.name,
          sender: {
            name: msg.user.name,
            email: msg.user.email,
          },
        })
      );

      const dms: SearchResult[] = dmsResponse.data.map((dm: DirectMessage) => ({
        id: dm.id,
        content: dm.content,
        createdAt: dm.createdAt,
        type: "dm",
        senderId: dm.senderId,
        sender: {
          name: dm.sender.name,
          email: dm.sender.email,
        },
      }));

      setSearchResults([...messages, ...dms]);
      setShowResults(true);
    } catch (error) {
      console.error("Failed to search:", error);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    // Navigate to the message
    if (result.type === "message") {
      navigate(`/channels/${result.channelId}?messageId=${result.id}`);
    } else {
      navigate(`/dm/${result.senderId}?messageId=${result.id}`);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-14 bg-[var(--background-light)] border-b border-[var(--border)] flex items-center justify-between px-4">
      {/* Left Side - Theme Selector */}
      <div className="w-48">
        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          className="px-2 py-1 bg-[var(--input-bg)] text-[var(--text)] border border-[var(--border)] rounded hover:border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          {Object.entries(themes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Center - Search Bar */}
      <div ref={searchRef} className="flex-1 max-w-2xl mx-auto relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search messages and channels"
            className="w-full bg-[var(--input-bg)] text-[var(--input-text)] px-4 py-1.5 pl-10 rounded border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent placeholder-[var(--input-placeholder)]"
          />
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full text-left p-3 hover:bg-[var(--background-hover)] border-b border-[var(--border)] last:border-0"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[var(--text)] font-medium">
                      {result.sender.name || result.sender.email}
                    </p>
                    <p className="text-[var(--text-muted)] text-sm mt-1">
                      {result.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-[var(--text-muted)]">
                      {formatDate(result.createdAt)}
                    </span>
                    {result.channelName && (
                      <span className="text-xs text-[var(--primary)] mt-1">
                        #{result.channelName}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Side Actions */}
      <div className="w-48 flex items-center justify-end space-x-4">
        <button
          onClick={() => navigate("/profile")}
          className="p-2 text-[var(--text)] hover:text-[var(--text)] hover:bg-[var(--background-hover)] rounded transition-colors duration-200"
          title="Profile"
        >
          <User className="w-5 h-5" />
        </button>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-[var(--text)] hover:text-[var(--text)] hover:bg-[var(--background-hover)] rounded transition-colors duration-200 flex items-center space-x-2"
        >
          <LogOut className="w-5 h-5" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
