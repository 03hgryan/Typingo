// types.ts - Shared type definitions

export interface AudioChunk {
  pcm: Int16Array;
  chunk_index: number;
  duration_ms: number;
}

// Message types for chrome.runtime communication
export type MessageToBackground =
  | { type: "START_CAPTURE" }
  | { type: "STOP_CAPTURE" }
  | { type: "GET_CAPTURE_STATE" }
  | { type: "GET_ASR_PROVIDER" }
  | { type: "SET_ASR_PROVIDER"; provider: AsrProvider }
  | { type: "GET_TARGET_LANG" }
  | { type: "SET_TARGET_LANG"; lang: TargetLanguage }
  | { type: "GET_SOURCE_LANG" }
  | { type: "SET_SOURCE_LANG"; lang: SourceLanguage }
  | { type: "AUDIO_CHUNK"; chunk: { pcm: number[]; chunk_index: number; duration_ms: number } };

export type MessageFromBackground =
  | { type: "CAPTURE_STARTED" }
  | { type: "CAPTURE_STOPPED" }
  | { type: "CAPTURE_ERROR"; error: string }
  | { type: "WS_CONNECTED" }
  | { type: "WS_DISCONNECTED" }
  | { type: "WS_ERROR"; error: string }
  | { type: "COMBINED"; text: string }
  | { type: "TRANSLATION"; text: string }
  | { type: "TRANSCRIPT"; text: string }
  | { type: "ERROR"; message: string };

// Messages to content script
export type MessageToContent =
  | { type: "SHOW_CAPTION"; text: string }
  | { type: "HIDE_CAPTION"; delay?: number }
  | { type: "REMOVE_CAPTION" };

// WebSocket messages from backend
export interface WSCombinedMessage {
  type: "combined";
  seq: number;
  full: string;
}

export interface WSTranslationMessage {
  type: "translation";
  seq: number;
  text: string;
}

export interface WSPartialMessage {
  type: "partial";
  text: string;
}

export interface WSSessionMessage {
  type: "session_started";
  data: unknown;
}

export interface WSErrorMessage {
  type: "error";
  message: string;
}

export type WSMessage = WSCombinedMessage | WSTranslationMessage | WSPartialMessage | WSSessionMessage | WSErrorMessage;

// ASR provider
export type AsrProvider = "elevenlabs" | "speechmatics";
export const DEFAULT_ASR_PROVIDER: AsrProvider = "elevenlabs";

// Target language
export type TargetLanguage = "Korean" | "Japanese" | "Chinese" | "Spanish" | "French" | "German";
export const DEFAULT_TARGET_LANG: TargetLanguage = "Korean";

// Source language (for Speechmatics ASR)
export type SourceLanguage = "en" | "ko" | "ja" | "zh" | "es" | "fr" | "de";
export const DEFAULT_SOURCE_LANG: SourceLanguage = "en";

// Settings storage
export interface StorageSettings {
  chunkDurationSec?: number;
  asrProvider?: AsrProvider;
  targetLang?: TargetLanguage;
  sourceLang?: SourceLanguage;
}

export const DEFAULT_CHUNK_DURATION_SEC = 0.32;
