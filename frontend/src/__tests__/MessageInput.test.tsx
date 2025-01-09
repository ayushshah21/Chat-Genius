/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MessageInput from "../components/Message/MessageInput";
import { socket } from "../lib/socket";
import axiosInstance from "../lib/axios";

// Mock the socket and axios
vi.mock("../lib/socket", () => ({
  socket: {
    emit: vi.fn(),
  },
}));

vi.mock("../lib/axios");

describe("MessageInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders input field and send button", () => {
    render(<MessageInput />);
    expect(
      screen.getByPlaceholderText("Type a message...")
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles text message submission in channel", async () => {
    const channelId = "channel1";
    render(<MessageInput channelId={channelId} />);

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.submit(screen.getByRole("form"));

    expect(socket.emit).toHaveBeenCalledWith("send_message", {
      content: "Hello world",
      channelId,
      parentId: undefined,
    });
  });

  it("handles text message submission in DM", async () => {
    const dmUserId = "user1";
    render(<MessageInput dmUserId={dmUserId} />);

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Hello DM" } });
    fireEvent.submit(screen.getByRole("form"));

    expect(socket.emit).toHaveBeenCalledWith("send_dm", {
      content: "Hello DM",
      receiverId: dmUserId,
      parentId: undefined,
    });
  });

  it("handles file upload in channel", async () => {
    const channelId = "channel1";
    const file = new File(["test content"], "test.txt", { type: "text/plain" });
    const mockUploadUrl = "http://test-upload-url";
    const mockFileId = "file1";
    const mockMessageId = "message1";

    (axiosInstance.post as any).mockResolvedValueOnce({
      data: {
        url: mockUploadUrl,
        fileId: mockFileId,
        messageId: mockMessageId,
      },
    });

    render(<MessageInput channelId={channelId} />);

    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith("file_upload_complete", {
        channelId,
        fileId: mockFileId,
        messageId: mockMessageId,
        size: file.size,
      });
    });
  });

  it("handles file upload in DM", async () => {
    const dmUserId = "user1";
    const file = new File(["test content"], "test.txt", { type: "text/plain" });
    const mockUploadUrl = "http://test-upload-url";
    const mockFileId = "file1";
    const mockMessageId = "message1";

    (axiosInstance.post as any).mockResolvedValueOnce({
      data: {
        url: mockUploadUrl,
        fileId: mockFileId,
        messageId: mockMessageId,
      },
    });

    render(<MessageInput dmUserId={dmUserId} />);

    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith("file_upload_complete", {
        dmUserId,
        fileId: mockFileId,
        messageId: mockMessageId,
        size: file.size,
      });
    });
  });

  it("handles thread replies", async () => {
    const parentId = "parent1";
    const channelId = "channel1";
    render(<MessageInput channelId={channelId} parentId={parentId} isThread />);

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Thread reply" } });
    fireEvent.submit(screen.getByRole("form"));

    expect(socket.emit).toHaveBeenCalledWith("send_message", {
      content: "Thread reply",
      channelId,
      parentId,
    });
  });
});
