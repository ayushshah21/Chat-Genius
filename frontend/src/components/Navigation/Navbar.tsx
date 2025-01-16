import { useState, useEffect, useRef } from "react";
import { Search, User, LogOut, Sparkles, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { API_CONFIG } from "../../config/api.config";
import { Message } from "../../types/message";
import { DirectMessage } from "../../types/directMessage";
import { socket } from "../../lib/socket";
import AISearchResults from "../search/AISearchResults";

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

interface AISearchResult {
  answer: string;
  analysis?: string;
  evidence: {
    content: string;
    messageId: string;
    channelId?: string;
    timestamp: string;
    userName?: string;
  }[];
  additionalContext?: string;
}

interface Props {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [theme, setTheme] = useState("default");
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isAISearch, setIsAISearch] = useState(false);
  const [aiResults, setAIResults] = useState<AISearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [inputValue, setInputValue] = useState("");

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
      setAIResults(null);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true); // Show results container immediately for loading state

    try {
      if (isAISearch) {
        // AI search is handled by handleAISearch
        return;
      }

      // Regular search logic
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
      setShowResults(false);
    } finally {
      setIsSearching(false);
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

  const handleNavigateToMessage = (
    messageId: string,
    channelId?: string,
    isDM?: boolean,
    userId?: string
  ) => {
    setShowResults(false);
    if (isDM && userId) {
      navigate(`/dm/${userId}?messageId=${messageId}`);
    } else if (channelId) {
      navigate(`/channels/${channelId}?messageId=${messageId}`);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    // If the input is cleared, reset everything including AI mode
    if (!value.trim()) {
      setIsAISearch(false); // Exit AI mode automatically
      setSearchResults([]);
      setAIResults(null);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    // Only perform regular search if not in AI mode
    if (!isAISearch) {
      handleSearch(value);
    }
  };

  const handleAISearch = async () => {
    if (inputValue.trim().length < 2) return;

    setIsSearching(true);
    setShowResults(true); // Show results container immediately for loading state
    setAIResults(null); // Clear previous results while loading

    try {
      const response = await axiosInstance.get(
        `${API_CONFIG.ENDPOINTS.AI.SEARCH}?query=${encodeURIComponent(
          inputValue
        )}`
      );
      setAIResults(response.data);
      setShowResults(true);
    } catch (error) {
      console.error("Failed to perform AI search:", error);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleAISearch = async () => {
    const newMode = !isAISearch;
    setIsAISearch(newMode);
    setShowResults(false); // Hide results when switching modes
    setAIResults(null);
    setSearchResults([]);
    setIsSearching(false);

    // Clear results when switching to normal search
    if (!newMode) {
      if (inputValue.trim().length >= 2) {
        handleSearch(inputValue); // Trigger normal search if we have input
      }
    } else {
      // Trigger AI search immediately if we have input
      if (inputValue.trim().length >= 2) {
        handleAISearch();
      }
    }
  };

  return (
    <div className="h-14 bg-[var(--background-light)] border-b border-[var(--border)] flex items-center justify-between px-4">
      {/* Left Side - Theme Selector and Menu */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-[var(--text)] hover:bg-[var(--background-hover)] rounded-lg transition-colors md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          className="px-2 py-1 bg-[var(--input-bg)] text-[var(--text)] border border-[var(--border)] rounded hover:border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] hidden sm:block"
        >
          {Object.entries(themes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Center - Search Bar */}
      <div
        ref={searchRef}
        className="flex-1 max-w-2xl mx-4 relative hidden sm:block"
      >
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                isAISearch ? "Ask anything..." : "Search messages and channels"
              }
              className="w-full bg-[var(--input-bg)] text-[var(--input-text)] px-4 py-1.5 pl-10 rounded-l border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent placeholder-[var(--input-placeholder)]"
            />
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
          </div>

          {isAISearch ? (
            // AI Search Button
            <button
              onClick={handleAISearch}
              className={`px-3 py-1.5 rounded-r border border-l-0 border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors duration-200 ${
                isAISearch
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"
                  : "bg-[var(--input-bg)] text-[var(--text-muted)]"
              }`}
              title="Search with AI"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          ) : (
            // Toggle Button for switching modes
            <button
              onClick={toggleAISearch}
              className="px-3 py-1.5 rounded-r border border-l-0 border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors duration-200 bg-[var(--input-bg)] text-[var(--text-muted)]"
              title="Switch to AI search"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute top-full mt-2 w-full bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
            {isAISearch ? (
              aiResults ? (
                <AISearchResults
                  {...aiResults}
                  onNavigateToMessage={handleNavigateToMessage}
                  isLoading={isSearching}
                />
              ) : isSearching ? (
                <AISearchResults
                  answer=""
                  evidence={[]}
                  onNavigateToMessage={handleNavigateToMessage}
                  isLoading={true}
                />
              ) : null
            ) : (
              // Existing search results UI
              searchResults.map((result) => (
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
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          className="p-2 text-[var(--text)] hover:text-[var(--text)] hover:bg-[var(--background-hover)] rounded transition-colors duration-200"
          title="Profile"
        >
          <User className="w-5 h-5" />
        </button>
        <button
          onClick={handleLogout}
          className="hidden sm:flex px-3 py-1.5 text-[var(--text)] hover:text-[var(--text)] hover:bg-[var(--background-hover)] rounded transition-colors duration-200 items-center space-x-2"
        >
          <LogOut className="w-5 h-5" />
          <span>Log out</span>
        </button>
        <button
          onClick={handleLogout}
          className="sm:hidden p-2 text-[var(--text)] hover:text-[var(--text)] hover:bg-[var(--background-hover)] rounded transition-colors duration-200"
          title="Log out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
