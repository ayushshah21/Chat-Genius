import React from "react";
import { Message as MessageType, DirectMessage } from "../../types";
import { formatTimestamp } from "../../utils/date";
import { DeleteButton } from "./DeleteButton";

interface MessageProps {
  message: MessageType | DirectMessage;
  isDM?: boolean;
  channelId?: string;
  currentUserId: string;
}

export const Message: React.FC<MessageProps> = ({
  message,
  isDM = false,
  channelId,
  currentUserId,
}) => {
  return (
    <div className="group flex items-start space-x-3 px-4 py-2 hover:bg-[var(--background-hover)]">
      <div className="flex-grow">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-[var(--text)]">
            {isDM
              ? (message as DirectMessage).sender.name
              : (message as MessageType).user.name}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {formatTimestamp(message.createdAt)}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DeleteButton
              messageId={message.id}
              channelId={channelId}
              dmUserId={
                isDM ? (message as DirectMessage).receiver.id : undefined
              }
              isAuthor={
                isDM
                  ? (message as DirectMessage).sender.id === currentUserId
                  : (message as MessageType).user.id === currentUserId
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
