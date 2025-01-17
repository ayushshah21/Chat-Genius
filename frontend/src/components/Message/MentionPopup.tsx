import { User } from "../../types/user";

interface MentionPopupProps {
  users: User[];
  searchTerm: string;
  selectedIndex: number;
  position: { x: number; y: number };
  onSelect: (user: User) => void;
  onClose: () => void;
}

export default function MentionPopup({
  users,
  searchTerm,
  selectedIndex,
  position,
  onSelect,
}: MentionPopupProps) {
  // Highlight matching text in user name/email
  // MentionPopup.tsx

  function highlightMatch(text: string) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <strong key={i} className="text-[var(--text)] font-semibold">
          {part}
        </strong>
      ) : (
        part
      )
    );
  }

  return (
    <div
      className="fixed z-50 w-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background-light)] shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        maxHeight: `${Math.min(users.length * 52 + 8, 240)}px`, // 52px per item + 8px padding
      }}
    >
      {users.length === 0 ? (
        <div className="p-3 text-sm text-[var(--text-muted)]">
          No users found
        </div>
      ) : (
        <div className="py-1">
          {users.map((user, index) => (
            <button
              key={user.id}
              className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-[var(--background-hover)] ${
                index === selectedIndex ? "bg-[var(--background-hover)]" : ""
              }`}
              onClick={() => onSelect(user)}
              onMouseDown={(e) => e.preventDefault()} // Prevent input blur
            >
              {/* Avatar */}
              <img
                src={
                  user.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${
                    user.name || user.email
                  }&background=random`
                }
                alt={user.name || user.email}
                className="w-6 h-6 rounded-full flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                {/* Name */}
                {user.name && (
                  <div className="text-sm font-medium text-[var(--text)] truncate">
                    {highlightMatch(user.name)}
                  </div>
                )}
                {/* Email */}
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {highlightMatch(user.email)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
