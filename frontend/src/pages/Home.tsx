import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  MessageSquare,
  Layout,
  Users,
  Shield,
  Settings,
  Database,
} from "lucide-react";
import { socket } from "../lib/socket";
import { useUserStatus } from "../contexts/UserStatusContext";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, setIsAuthenticated } = useUserStatus();

  useEffect(() => {
    const token = searchParams.get("token");
    const userDataParam = searchParams.get("userData");

    if (token) {
      localStorage.setItem("token", token);
      if (userDataParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userDataParam));
          localStorage.setItem("userId", userData.id);
          localStorage.setItem("userName", userData.name);
          localStorage.setItem("userEmail", userData.email);
          localStorage.setItem("userAvatar", userData.avatarUrl || "");
          localStorage.setItem("userStatus", userData.status);
        } catch (err) {
          console.error("Failed to parse user data:", err);
        }
      }
      setIsAuthenticated(true);
      navigate("/channels");
      return;
    }
  }, [navigate, searchParams, setIsAuthenticated]);

  const handleLogout = async () => {
    try {
      // Emit logout event before clearing data
      if (socket.connected) {
        socket.emit("logout");
        socket.disconnect();
      }
      localStorage.clear();
      setIsAuthenticated(false);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      localStorage.clear();
      setIsAuthenticated(false);
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Navigation Bar */}
      <nav className="bg-[var(--background-light)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="text-[var(--primary)] font-bold text-xl">
                ChatGenius
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-[var(--text)]">
                    Welcome, {localStorage.getItem("userEmail")}
                  </span>
                  <Link
                    to="/channels"
                    className="text-[var(--primary)] hover:brightness-110 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Channels
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-[var(--accent)] hover:brightness-110 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-[var(--text)] hover:text-[var(--text-secondary)] px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-[var(--primary)] text-[var(--text)] hover:brightness-110 px-4 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 lg:w-full lg:max-w-2xl">
            <div className="text-center sm:text-left">
              <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text)] sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="block">Your Ultimate</span>
                <span className="block text-[var(--primary)] mt-2">
                  AI-Powered Chat Solution
                </span>
              </h1>
              <p className="mt-6 text-xl text-[var(--text-muted)] max-w-3xl">
                Experience the future of communication with ChatGenius. Our
                AI-powered platform offers seamless, intelligent conversations
                for both personal and business use.
              </p>
              <div className="mt-10">
                <Link
                  to="/register"
                  className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg"
                >
                  Get started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-[var(--background)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold text-[var(--primary)] tracking-wide uppercase">
              FEATURES
            </h2>
            <p className="mt-2 text-5xl font-extrabold text-[var(--text)] tracking-tight">
              Everything you need for smart communication
            </p>
            <p className="mt-4 max-w-2xl text-xl text-[var(--text-muted)] lg:mx-auto">
              ChatGenius combines cutting-edge AI with user-friendly design to
              revolutionize your chat experience.
            </p>
          </div>

          <div className="mt-20">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {/* AI-Powered Conversations */}
              <div className="text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[var(--background-light)] mx-auto">
                  <MessageSquare className="h-8 w-8 text-[var(--primary)]" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                  AI-Powered Conversations
                </h3>
                <p className="mt-2 text-base text-[var(--text-muted)]">
                  Engage in intelligent, context-aware chats with our advanced
                  AI technology.
                </p>
              </div>

              {/* Real-time Collaboration */}
              <div className="text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[var(--background-light)] mx-auto">
                  <Users className="h-8 w-8 text-[var(--primary)]" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                  Real-time Collaboration
                </h3>
                <p className="mt-2 text-base text-[var(--text-muted)]">
                  Seamlessly work together with multiple users in real-time chat
                  rooms.
                </p>
              </div>

              {/* Secure Communication */}
              <div className="text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[var(--background-light)] mx-auto">
                  <Shield className="h-8 w-8 text-[var(--primary)]" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                  Secure Communication
                </h3>
                <p className="mt-2 text-base text-[var(--text-muted)]">
                  Your conversations are protected with end-to-end encryption
                  and advanced security measures.
                </p>
              </div>

              {/* Smart Integrations */}
              <div className="text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[var(--background-light)] mx-auto">
                  <Layout className="h-8 w-8 text-[var(--primary)]" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                  Smart Integrations
                </h3>
                <p className="mt-2 text-base text-[var(--text-muted)]">
                  Connect with your favorite tools and services for enhanced
                  productivity.
                </p>
              </div>

              {/* Customizable Experience */}
              <div className="text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[var(--background-light)] mx-auto">
                  <Settings className="h-8 w-8 text-[var(--primary)]" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                  Customizable Experience
                </h3>
                <p className="mt-2 text-base text-[var(--text-muted)]">
                  Tailor the chat interface and AI responses to suit your
                  preferences and needs.
                </p>
              </div>

              {/* Advanced Analytics */}
              <div className="text-center">
                <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[var(--background-light)] mx-auto">
                  <Database className="h-8 w-8 text-[var(--primary)]" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text)]">
                  Advanced Analytics
                </h3>
                <p className="mt-2 text-base text-[var(--text-muted)]">
                  Gain valuable insights from your conversations with advanced
                  analytics tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-[var(--primary)] py-20 border-t border-[var(--border)] bg-[var(--background-light)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              <span className="block">Ready to experience the future?</span>
              <span className="block mt-2">Start chatting with AI today.</span>
            </h2>
            <p className="mt-4 text-xl leading-6 text-blue-100">
              Join thousands of users already revolutionizing their
              communication with ChatGenius.
            </p>
            <div className="mt-10">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-slate-50 bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg"
              >
                Get started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
