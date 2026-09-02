"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type SpeechRecognitionResultEventLike = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = Event & { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VoiceSearchInputProps = {
  defaultValue: string;
  locale: string;
  placeholder: string;
  startLabel: string;
  stopLabel: string;
  listeningLabel: string;
  unsupportedLabel: string;
  errorLabel: string;
  className?: string;
  inputClassName?: string;
};

export function VoiceSearchInput({
  defaultValue,
  locale,
  placeholder,
  startLabel,
  stopLabel,
  listeningLabel,
  unsupportedLabel,
  errorLabel,
  className,
  inputClassName,
}: VoiceSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setStatus(unsupportedLabel);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim();
      if (!transcript || !inputRef.current) return;

      inputRef.current.value = transcript;
      setStatus(transcript);
      inputRef.current.form?.requestSubmit();
    };
    recognition.onerror = () => {
      setStatus(errorLabel);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setStatus(listeningLabel);
    setListening(true);

    try {
      recognition.start();
    } catch {
      setStatus(errorLabel);
      setListening(false);
      recognitionRef.current = null;
    }
  }

  const buttonLabel = !supported
    ? unsupportedLabel
    : listening
      ? stopLabel
      : startLabel;

  return (
    <div className={clsx("relative", className)}>
      <input
        ref={inputRef}
        className={clsx("wt-input pr-12", inputClassName)}
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={toggleListening}
        disabled={!supported}
        aria-label={buttonLabel}
        aria-pressed={listening}
        title={buttonLabel}
        className={`absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${
          listening
            ? "bg-[var(--bottle)] text-white"
            : "text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--bottle)]"
        } disabled:cursor-not-allowed disabled:opacity-35`}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
        </svg>
      </button>
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
