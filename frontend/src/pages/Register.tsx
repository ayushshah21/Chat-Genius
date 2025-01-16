/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { AxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, UserPlus, User } from "lucide-react";
import { API_CONFIG } from "../config/api.config";
import axiosInstance from "../lib/axios";
import { useUserStatus } from "../contexts/UserStatusContext";
import { initSocket } from "../lib/socket";

interface ErrorResponse {
  error: string;
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setIsAuthenticated } = useUserStatus();

  useEffect(() => {
    const validateAndRedirect = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const response = await axiosInstance.get(
            API_CONFIG.ENDPOINTS.AUTH.PROTECTED
          );

          if (response.data.user) {
            navigate("/channels");
          } else {
            localStorage.removeItem("token");
          }
        } catch (err) {
          localStorage.removeItem("token");
        }
      }
    };

    validateAndRedirect();
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axiosInstance.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, {
        email,
        password,
        name,
      });

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        if (res.data.user) {
          localStorage.setItem("userId", res.data.user.id);
          localStorage.setItem("userName", res.data.user.name || "");
          localStorage.setItem("userEmail", res.data.user.email);
          localStorage.setItem("userAvatar", res.data.user.avatarUrl || "");
          localStorage.setItem("userStatus", res.data.user.status || "online");
        }

        // Initialize socket with the new token
        initSocket(res.data.token);

        // Set authentication state
        setIsAuthenticated(true);

        navigate("/channels");
      }
    } catch (err) {
      const error = err as AxiosError<ErrorResponse>;
      setError(error.response?.data.error || "Error registering");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[var(--background-light)] p-10 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text)]">
            Join ChatGenius
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
            Create your account
          </p>
        </div>

        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
            role="alert"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="name" className="sr-only">
                Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none rounded-t-md relative block w-full px-12 py-3 bg-[var(--background-light)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:z-10 sm:text-sm"
                  placeholder="Full name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-12 py-3 bg-[var(--background-light)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-b-md relative block w-full px-12 py-3 bg-[var(--background-light)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <UserPlus className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              Create account
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[var(--background-light)] text-[var(--text-muted)]">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-6">
            <a
              href={API_CONFIG.GOOGLE_OAUTH_URL}
              className="w-full inline-flex justify-center py-3 px-4 rounded-md shadow-sm bg-[var(--background-light)] hover:brightness-110 text-[var(--text)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
            >
              <span className="sr-only">Sign up with Google</span>
              <img
                className="h-5 w-5 mr-2"
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google logo"
              />
              <span>Sign up with Google</span>
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-[var(--primary)] hover:brightness-110"
          >
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
