import React, { useState } from "react";
import { AxiosError } from "axios";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { API_CONFIG } from "../../config/api.config";
import axiosInstance from "../../lib/axios";

interface TextToSpeechProps {
  text: string;
  userId?: string;
  className?: string;
}

export default function TextToSpeech({
  text,
  userId,
  className = "",
}: TextToSpeechProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string>("");
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setAudio(null);
    }
  };

  const handleSpeak = async () => {
    // If already playing, stop it
    if (isPlaying) {
      stopAudio();
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await axiosInstance.post(
        API_CONFIG.ENDPOINTS.TTS.GENERATE,
        { text, userId },
        {
          responseType: "blob",
        }
      );

      const audioUrl = URL.createObjectURL(response.data);
      const newAudio = new Audio(audioUrl);

      // Clean up when audio ends
      newAudio.onended = () => {
        setIsPlaying(false);
        setAudio(null);
        URL.revokeObjectURL(audioUrl);
      };

      // Start playing
      await newAudio.play();
      setAudio(newAudio);
      setIsPlaying(true);
    } catch (err) {
      console.error("Error generating speech:", err);
      let errorMessage = "Failed to generate speech";

      if (err instanceof AxiosError) {
        switch (err.response?.status) {
          case 401:
            errorMessage = "Please log in to use text-to-speech";
            break;
          case 403:
            errorMessage = "No voice configured for this user";
            break;
          case 429:
            errorMessage = "Rate limit exceeded. Please try later";
            break;
          default:
            errorMessage =
              err.response?.data?.error || "Failed to generate speech";
        }
      }

      setError(errorMessage);
      // Only show error for a brief moment
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={handleSpeak}
        disabled={isLoading}
        className="p-1 rounded-full hover:bg-[var(--background-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={isPlaying ? "Stop" : "Play"}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>
      {error && (
        <span className="text-xs text-red-500 animate-fade-out">{error}</span>
      )}
    </div>
  );
}
