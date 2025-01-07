import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Database, Layout, Terminal, MessageSquare, Users, Shield } from 'lucide-react';
import axiosInstance from "../lib/axios";
import { API_CONFIG } from "../config/api.config";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      navigate("/channels");
      return;
    }

    // Check if user is authenticated but don't redirect
    const checkAuth = async () => {
      const existingToken = localStorage.getItem("token");
      if (existingToken) {
        try {
          const response = await axiosInstance.get(
            API_CONFIG.ENDPOINTS.AUTH.PROTECTED
          );
          if (response.data.user) {
            setIsAuthenticated(true);
            setUserEmail(response.data.user.email);
          }
        } catch (err) {
          console.error(err);
          localStorage.removeItem("token");
        }
      }
    };

    checkAuth();
  }, [navigate, searchParams]);

  const handleLogout = async () => {
    try {
      await axiosInstance.get(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
      localStorage.removeItem("token");
      setIsAuthenticated(false);
      setUserEmail("");
    } catch (err) {
      console.error("Logout failed:", err);
      localStorage.removeItem("token");
      setIsAuthenticated(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="text-blue-600 font-bold text-xl">
                ChatGenius
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-gray-700">Welcome, {userEmail}</span>
                  <Link
                    to="/channels"
                    className="text-blue-600 hover:text-blue-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Channels
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-red-600 hover:text-red-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
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
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 lg:w-full lg:max-w-2xl">
            <div className="text-center sm:text-left">
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="block">Your Ultimate</span>
                <span className="block text-blue-600 mt-2">
                  AI-Powered Chat Solution
                </span>
              </h1>
              <p className="mt-6 text-xl text-gray-500 max-w-3xl">
                Experience the future of communication with ChatGenius. Our AI-powered platform offers seamless, intelligent conversations for both personal and business use.
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
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
              Everything you need for smart communication
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              ChatGenius combines cutting-edge AI with user-friendly design to revolutionize your chat experience.
            </p>
          </div>

          <div className="mt-20">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="bg-white rounded-lg shadow-md p-6 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.name}
                  </h3>
                  <p className="text-gray-500">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              <span className="block">Ready to experience the future?</span>
              <span className="block mt-2">Start chatting with AI today.</span>
            </h2>
            <p className="mt-4 text-xl leading-6 text-blue-100">
              Join thousands of users already revolutionizing their communication with ChatGenius.
            </p>
            <div className="mt-10">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-blue-600 bg-white hover:bg-blue-50 md:py-4 md:text-lg md:px-10 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg"
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

const features = [
  {
    name: "AI-Powered Conversations",
    description:
      "Engage in intelligent, context-aware chats with our advanced AI technology.",
    icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
  },
  {
    name: "Real-time Collaboration",
    description: "Seamlessly work together with multiple users in real-time chat rooms.",
    icon: <Users className="w-6 h-6 text-blue-600" />,
  },
  {
    name: "Secure Communication",
    description: "Your conversations are protected with end-to-end encryption and advanced security measures.",
    icon: <Shield className="w-6 h-6 text-blue-600" />,
  },
  {
    name: "Smart Integrations",
    description: "Connect with your favorite tools and services for enhanced productivity.",
    icon: <Layout className="w-6 h-6 text-blue-600" />,
  },
  {
    name: "Customizable Experience",
    description: "Tailor the chat interface and AI responses to suit your preferences and needs.",
    icon: <Terminal className="w-6 h-6 text-blue-600" />,
  },
  {
    name: "Analytics and Insights",
    description: "Gain valuable insights from your conversations with advanced analytics tools.",
    icon: <Database className="w-6 h-6 text-blue-600" />,
  },
];

