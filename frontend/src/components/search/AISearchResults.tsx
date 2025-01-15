import { MessageSquare, ExternalLink } from "lucide-react";

interface AISearchResultProps {
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
  onNavigateToMessage: (messageId: string, channelId?: string) => void;
  isLoading?: boolean;
}

export default function AISearchResults({
  answer,
  analysis,
  evidence,
  additionalContext,
  onNavigateToMessage,
  isLoading,
}: AISearchResultProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-4 bg-[var(--background-hover)] rounded w-3/4"></div>
        <div className="h-4 bg-[var(--background-hover)] rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
      {/* Answer Section */}
      <div className="p-4 border-b border-[var(--border)]">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
          Answer
        </h3>
        <p className="text-[var(--text)]">{answer}</p>
      </div>

      {/* Analysis Section */}
      {analysis && (
        <div className="p-4 border-b border-[var(--border)] bg-[var(--background-light)]">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">
            Analysis
          </h3>
          <p className="text-sm text-[var(--text)]">{analysis}</p>
        </div>
      )}

      {/* Supporting Evidence */}
      <div className="p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">
          Supporting Evidence
        </h3>
        <div className="space-y-3">
          {evidence.map((item) => (
            <button
              key={item.messageId}
              onClick={() =>
                onNavigateToMessage(item.messageId, item.channelId)
              }
              className="w-full text-left p-3 rounded-md hover:bg-[var(--background-hover)] transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <MessageSquare className="w-4 h-4 text-[var(--text-muted)] mt-1" />
                  <div>
                    {item.userName && (
                      <p className="text-sm font-medium text-[var(--text)]">
                        {item.userName}
                      </p>
                    )}
                    <p className="text-sm text-[var(--text)]">{item.content}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {item.timestamp}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Context */}
      {additionalContext && (
        <div className="p-4 bg-[var(--background-light)]">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">
            Additional Context
          </h3>
          <p className="text-sm text-[var(--text)]">{additionalContext}</p>
        </div>
      )}
    </div>
  );
}
