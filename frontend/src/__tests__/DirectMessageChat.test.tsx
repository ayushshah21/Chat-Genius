/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DirectMessageChat from "../components/DirectMessages/DirectMessageChat";
import { BrowserRouter } from "react-router-dom";
import { socket } from "../lib/socket";
import axiosInstance from "../lib/axios";

// Mock the socket and axios
vi.mock("../lib/socket", () => ({
  socket: {
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock("../lib/axios");

// Mock data
const mockMessages = [
  {
    id: "1",
    content: "Hello",
    senderId: "123",
    receiverId: "456",
    createdAt: new Date().toISOString(),
    sender: {
      id: "123",
      name: "John",
      email: "john@example.com",
      avatarUrl: null,
    },
    receiver: {
      id: "456",
      name: "Jane",
      email: "jane@example.com",
      avatarUrl: null,
    },
    files: [],
  },
];

describe("DirectMessageChat", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    localStorage.setItem("userId", "123");

    // Mock axios get request
    (axiosInstance.get as any).mockResolvedValue({ data: mockMessages });
  });

  it("renders loading state initially", () => {
    render(
      <BrowserRouter>
        <DirectMessageChat />
      </BrowserRouter>
    );
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("displays messages after loading", async () => {
    render(
      <BrowserRouter>
        <DirectMessageChat />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });

  it("joins DM room on mount", async () => {
    render(
      <BrowserRouter>
        <DirectMessageChat />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith("join_dm", expect.any(String));
    });
  });

  it("leaves DM room on unmount", async () => {
    const { unmount } = render(
      <BrowserRouter>
        <DirectMessageChat />
      </BrowserRouter>
    );

    unmount();

    expect(socket.emit).toHaveBeenCalledWith("leave_dm", expect.any(String));
  });

  it("handles file messages correctly", async () => {
    const messagesWithFile = [
      {
        ...mockMessages[0],
        files: [
          {
            id: "file1",
            name: "test.pdf",
            size: 1024,
          },
        ],
      },
    ];

    (axiosInstance.get as any).mockResolvedValueOnce({
      data: messagesWithFile,
    });

    render(
      <BrowserRouter>
        <DirectMessageChat />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("test.pdf")).toBeInTheDocument();
      expect(screen.getByText("1.0 KB")).toBeInTheDocument();
    });
  });
});
