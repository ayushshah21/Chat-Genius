import { useState, useCallback, useEffect, useMemo } from "react";
import { User } from "../types/user";

interface Position {
    x: number;
    y: number;
}

interface UseMentionProps {
    users: User[];
    inputRef: React.RefObject<HTMLTextAreaElement>;
    setMessage: (message: string) => void;
}

export default function useMention({ users, inputRef, setMessage }: UseMentionProps) {
    const [showPopup, setShowPopup] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

    // Use useMemo instead of useState + useEffect for filtered users
    const filteredUsers = useMemo(() => {
        if (!showPopup) return [];
        if (!searchTerm) return users;

        const term = searchTerm.toLowerCase();
        return users.filter(
            (user) =>
                (user.name && user.name.toLowerCase().includes(term)) ||
                user.email.toLowerCase().includes(term)
        );
    }, [users, searchTerm, showPopup]);

    // Reset selected index when filtered users change
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredUsers]);

    // Calculate popup position based on cursor position
    const calculatePosition = useCallback(() => {
        if (!inputRef.current) return null;

        const input = inputRef.current;
        const cursorPosition = input.selectionStart || 0;

        // Create a temporary div to measure text
        const div = document.createElement("div");
        div.style.position = "absolute";
        div.style.visibility = "hidden";
        div.style.whiteSpace = "pre-wrap";
        div.style.wordWrap = "break-word";
        div.style.width = getComputedStyle(input).width;
        div.style.font = getComputedStyle(input).font;
        div.style.padding = getComputedStyle(input).padding;

        // Get text before cursor
        const textBeforeCursor = input.value.substring(0, cursorPosition);
        div.textContent = textBeforeCursor;

        document.body.appendChild(div);

        // Calculate position
        const inputRect = input.getBoundingClientRect();

        document.body.removeChild(div);

        // Constants
        const POPUP_MARGIN = 8; // pixels of spacing
        const POPUP_WIDTH = 256; // width of popup (matches w-64 class)
        const ITEM_HEIGHT = 52; // height of each user item
        const PADDING = 8; // padding of the popup
        const MAX_HEIGHT = 240; // maximum height of popup

        // Calculate popup height based on number of items (or use max height for initial state)
        const popupHeight = !searchTerm
            ? MAX_HEIGHT  // Use full height when first showing popup
            : Math.min(filteredUsers.length * ITEM_HEIGHT + PADDING, MAX_HEIGHT);

        // Calculate x position
        let x = inputRect.left;
        if (x + POPUP_WIDTH > window.innerWidth) {
            x = window.innerWidth - POPUP_WIDTH - POPUP_MARGIN;
        }
        x = Math.max(POPUP_MARGIN, x);

        // Calculate y position - always start above input, then adjust based on filtered height
        const y = inputRect.top - popupHeight - POPUP_MARGIN;

        return { x, y };
    }, [filteredUsers, searchTerm]); // Add searchTerm to dependencies

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (!showPopup) return;

            switch (e.key) {
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : filteredUsers.length - 1
                    );
                    break;

                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < filteredUsers.length - 1 ? prev + 1 : 0
                    );
                    break;

                case "Enter":
                    e.preventDefault();
                    if (filteredUsers[selectedIndex]) {
                        handleSelect(filteredUsers[selectedIndex]);
                    }
                    break;

                case "Escape":
                    e.preventDefault();
                    closePopup();
                    break;
            }
        },
        [showPopup, filteredUsers, selectedIndex]
    );

    // Handle mention trigger
    const handleMentionTrigger = useCallback(
        (text: string, cursorPosition: number) => {
            const textBeforeCursor = text.slice(0, cursorPosition);
            const atIndex = textBeforeCursor.lastIndexOf("@");

            if (atIndex >= 0) {
                const hasSpaceAfterAt = /\s/.test(
                    textBeforeCursor.slice(atIndex + 1, atIndex + 2)
                );
                const mentionText = textBeforeCursor.slice(atIndex + 1);
                const hasEndingSpace = /[\s]/.test(mentionText);

                if (!hasSpaceAfterAt && !hasEndingSpace) {
                    setSearchTerm(mentionText);
                    const pos = calculatePosition();
                    if (pos) {
                        setPosition(pos);
                        setShowPopup(true);
                    }
                    return;
                }
            }

            closePopup();
        },
        [calculatePosition]
    );

    // Close popup and reset state
    const closePopup = useCallback(() => {
        setShowPopup(false);
        setSearchTerm("");
        setSelectedIndex(0);
    }, []);

    const handleSelect = useCallback(
        (user: User) => {
            if (!inputRef.current) return;

            const input = inputRef.current;
            const text = input.value;
            const cursorPosition = input.selectionStart || 0;
            const textBeforeCursor = text.slice(0, cursorPosition);
            const atIndex = textBeforeCursor.lastIndexOf("@");
            const textAfterCursor = text.slice(cursorPosition);

            // Build the mention string with email and greeting
            const mentionString = `@${user.email} `;

            // Replace the substring from the '@' up to current cursor with mentionString
            const newText = text.slice(0, atIndex) + mentionString + textAfterCursor;

            // Update the message state in parent component
            setMessage(newText);

            // Set cursor position after a short delay to ensure the textarea has updated
            setTimeout(() => {
                if (inputRef.current) {
                    const newCursorPosition = atIndex + mentionString.length;
                    inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
                    inputRef.current.focus();
                }
            }, 0);

            // Close the popup
            closePopup();
        },
        [closePopup, setMessage]
    );

    return {
        showPopup,
        searchTerm,
        selectedIndex,
        position,
        filteredUsers,
        handleMentionTrigger,
        handleKeyDown,
        handleSelect,
        closePopup,
    };
} 