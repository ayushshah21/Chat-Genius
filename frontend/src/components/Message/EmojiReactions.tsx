/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { socket } from "../../lib/socket";
import { Smile, Plus } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface User {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface EmojiReaction {
  id?: string;
  emoji: string;
  users: User[];
  user?: User;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  messageId: string;
  isDM?: boolean;
  reactions: EmojiReaction[];
}

export default function EmojiReactions({
  messageId,
  isDM = false,
  reactions: initialReactions = [],
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [reactions, setReactions] = useState<EmojiReaction[]>(initialReactions);
  const currentUserId = localStorage.getItem("userId");
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update reactions when props change
  useEffect(() => {
    if (initialReactions && Array.isArray(initialReactions)) {
      const validatedReactions = initialReactions
        .filter(
          (reaction): reaction is Required<EmojiReaction> =>
            !!reaction && !!reaction.emoji && Array.isArray(reaction.users)
        )
        .map((reaction) => ({
          ...reaction,
          users: reaction.users.filter(
            (u): u is Required<User> => !!u && !!u.id && !!u.email
          ),
        }))
        .filter((reaction) => reaction.users.length > 0);

      setReactions(validatedReactions);
    }
  }, [initialReactions]);

  useEffect(() => {
    const handleReactionAdded = (data: {
      messageId: string;
      reactions: EmojiReaction[];
    }) => {
      if (data.messageId === messageId) {
        if (Array.isArray(data.reactions)) {
          const validatedReactions = data.reactions
            .filter(
              (
                reaction
              ): reaction is Required<EmojiReaction> & {
                user: Required<User>;
              } =>
                !!reaction &&
                !!reaction.emoji &&
                !!reaction.user &&
                !!reaction.user.id &&
                !!reaction.user.email
            )
            .map((reaction) => ({
              emoji: reaction.emoji,
              users: [
                {
                  id: reaction.user.id,
                  name: reaction.user.name,
                  email: reaction.user.email,
                  avatarUrl: reaction.user.avatarUrl,
                },
              ],
            }));

          setReactions(validatedReactions);
        }
      }
    };

    const handleReactionRemoved = (data: {
      messageId: string;
      reactions: EmojiReaction[];
    }) => {
      if (data.messageId === messageId) {
        if (Array.isArray(data.reactions)) {
          const validatedReactions = data.reactions
            .filter(
              (
                reaction
              ): reaction is Required<EmojiReaction> & {
                user: Required<User>;
              } =>
                !!reaction &&
                !!reaction.emoji &&
                !!reaction.user &&
                !!reaction.user.id &&
                !!reaction.user.email
            )
            .map((reaction) => ({
              emoji: reaction.emoji,
              users: [
                {
                  id: reaction.user.id,
                  name: reaction.user.name,
                  email: reaction.user.email,
                  avatarUrl: reaction.user.avatarUrl,
                },
              ],
            }));

          setReactions(validatedReactions);
        }
      }
    };

    // Listen for both channel and DM reaction events
    socket.on("message_reaction_added", handleReactionAdded);
    socket.on("message_reaction_removed", handleReactionRemoved);
    socket.on("dm_reaction_added", handleReactionAdded);
    socket.on("dm_reaction_removed", handleReactionRemoved);

    return () => {
      socket.off("message_reaction_added", handleReactionAdded);
      socket.off("message_reaction_removed", handleReactionRemoved);
      socket.off("dm_reaction_added", handleReactionAdded);
      socket.off("dm_reaction_removed", handleReactionRemoved);
    };
  }, [messageId, isDM]);

  const handleEmojiSelect = (emoji: any) => {
    try {
      if (!currentUserId) return;

      const newUser: User = {
        id: currentUserId,
        name: localStorage.getItem("userName") || null,
        email: localStorage.getItem("userEmail") || "",
        avatarUrl: localStorage.getItem("userAvatar") || null,
      };

      const newReaction: EmojiReaction = {
        emoji: emoji.native,
        users: [newUser],
      };

      setReactions((prevReactions) => {
        const existingReactionIndex = prevReactions.findIndex(
          (r) => r.emoji === emoji.native
        );

        if (existingReactionIndex === -1) {
          return [...prevReactions, newReaction];
        }

        const updatedReactions = [...prevReactions];
        const existingReaction = updatedReactions[existingReactionIndex];

        if (!existingReaction.users.some((u) => u.id === currentUserId)) {
          existingReaction.users = [...existingReaction.users, newUser];
        }

        return updatedReactions;
      });

      // Send to backend with appropriate message type
      const payload = {
        emoji: emoji.native,
        messageId,
        isDM,
        type: isDM ? "directMessageId" : "messageId",
      };

      socket.emit("add_reaction", payload);
    } catch (error) {
      console.error("[EmojiReactions] Error handling emoji select:", error);
    } finally {
      setShowPicker(false);
    }
  };

  const handleReactionClick = (emoji: string) => {
    try {
      if (!currentUserId) return;

      const hasReacted = reactions.some(
        (reaction) =>
          reaction.emoji === emoji &&
          reaction.users?.some((user) => user?.id === currentUserId)
      );

      if (hasReacted) {
        setReactions((prevReactions) => {
          const updatedReactions = prevReactions.map((reaction) => {
            if (reaction.emoji === emoji) {
              const updatedUsers = reaction.users.filter(
                (user) => user?.id !== currentUserId
              );
              return updatedUsers.length > 0
                ? { ...reaction, users: updatedUsers }
                : null;
            }
            return reaction;
          });

          return updatedReactions.filter(
            (reaction): reaction is EmojiReaction => reaction !== null
          );
        });

        // Send to backend with appropriate message type
        const payload = {
          emoji,
          messageId,
          isDM,
          type: isDM ? "directMessageId" : "messageId",
        };

        socket.emit("remove_reaction", payload);
      } else {
        const newUser = {
          id: currentUserId,
          name: localStorage.getItem("userName") || null,
          email: localStorage.getItem("userEmail") || "",
          avatarUrl: localStorage.getItem("userAvatar") || null,
        };

        setReactions((prevReactions) => {
          const existingReactionIndex = prevReactions.findIndex(
            (r) => r.emoji === emoji
          );

          if (existingReactionIndex === -1) {
            return [
              ...prevReactions,
              {
                emoji,
                users: [newUser],
              },
            ];
          } else {
            const updatedReactions = [...prevReactions];
            const existingReaction = updatedReactions[existingReactionIndex];

            if (!existingReaction.users.some((u) => u.id === currentUserId)) {
              existingReaction.users = [...existingReaction.users, newUser];
            }

            return updatedReactions;
          }
        });

        // Send to backend with appropriate message type
        const payload = {
          emoji,
          messageId,
          isDM,
          type: isDM ? "directMessageId" : "messageId",
        };

        socket.emit("add_reaction", payload);
      }
    } catch (error) {
      console.error("[EmojiReactions] Error handling reaction click:", error);
    }
  };

  // Filter out invalid reactions and ensure users array exists
  const validReactions = reactions
    .filter(
      (reaction) =>
        reaction &&
        reaction.emoji &&
        reaction.users &&
        Array.isArray(reaction.users) &&
        reaction.users.some((u) => u && u.id)
    )
    .map((reaction) => ({
      ...reaction,
      users: reaction.users.filter((u) => u && u.id),
    }));

  // Group reactions by emoji
  const groupedReactions = validReactions.reduce((acc, reaction) => {
    if (!reaction.emoji || !reaction.users) return acc;

    const existing = acc.find((r) => r.emoji === reaction.emoji);
    if (existing && existing.users) {
      // Combine users from both reactions, ensuring no duplicates
      const uniqueUsers = Array.from(
        new Set([...existing.users, ...reaction.users].map((u) => u.id))
      )
        .map((id) => {
          const user = [...existing.users, ...reaction.users].find(
            (u) => u.id === id
          );
          if (!user) return null;
          return user;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      existing.users = uniqueUsers;
    } else {
      acc.push({
        emoji: reaction.emoji,
        users: [...reaction.users],
      });
    }

    return acc;
  }, [] as EmojiReaction[]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        {groupedReactions.map((reaction) => {
          const hasReacted = reaction.users?.some(
            (user) => user?.id === currentUserId
          );
          return (
            <button
              key={reaction.emoji}
              onClick={() => handleReactionClick(reaction.emoji)}
              className={`px-2 py-1 rounded-full text-sm flex items-center space-x-1 ${
                hasReacted
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-600"
              } hover:bg-gray-200 transition-colors duration-200`}
              title={
                reaction.users?.map((u) => u?.name || u?.email).join(", ") || ""
              }
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.users?.length || 0}</span>
            </button>
          );
        })}
        <button
          ref={buttonRef}
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-gray-400 hover:text-blue-400 flex items-center space-x-1 transition-colors duration-200"
          title="Add reaction"
        >
          {showPicker ? (
            <Plus className="w-3.5 h-3.5" />
          ) : (
            <Smile className="w-3.5 h-3.5" />
          )}
          <span>Add reaction</span>
        </button>
      </div>
      {showPicker && (
        <div
          ref={pickerRef}
          className="fixed z-50"
          style={{
            bottom: "100px",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-white rounded-lg shadow-lg p-2">
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="light"
              previewPosition="none"
              skinTonePosition="none"
              maxFrequentRows={2}
              perLine={9}
            />
          </div>
        </div>
      )}
    </div>
  );
}
