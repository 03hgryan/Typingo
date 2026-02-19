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
  | { type: "GET_AGGRESSIVENESS" }
  | { type: "SET_AGGRESSIVENESS"; aggressiveness: number }
  | { type: "GET_UPDATE_FREQUENCY" }
  | { type: "SET_UPDATE_FREQUENCY"; updateFrequency: number }
  | { type: "GET_DELAY_MS" }
  | { type: "SET_DELAY_MS"; delayMs: number }
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

// Target language (all DeepL-supported target languages)
export type TargetLanguage = string;
export const DEFAULT_TARGET_LANG: TargetLanguage = "Korean";

// Source language (for Speechmatics ASR)
export type SourceLanguage =
  | "ar" | "ba" | "eu" | "be" | "bn" | "bg" | "yue" | "ca" | "hr" | "cs"
  | "da" | "nl" | "en" | "eo" | "et" | "fi" | "fr" | "gl" | "de" | "el"
  | "he" | "hi" | "hu" | "id" | "ia" | "ga" | "it" | "ja" | "ko" | "lv"
  | "lt" | "ms" | "en_ms" | "mt" | "cmn" | "cmn_en" | "cmn_en_ms_ta"
  | "mr" | "mn" | "no" | "fa" | "pl" | "pt" | "ro" | "ru" | "sk" | "sl"
  | "es" | "sw" | "sv" | "tl" | "ta" | "en_ta" | "th" | "tr" | "uk"
  | "ur" | "ug" | "vi" | "cy";
export const DEFAULT_SOURCE_LANG: SourceLanguage = "en";

// Translator type
export type TranslatorType = "realtime" | "deepl" | "standard";
export const DEFAULT_TRANSLATOR: TranslatorType = "deepl";

// Aggressiveness (1 = high/fast, 2 = low/accurate)
export const DEFAULT_AGGRESSIVENESS = 1;

// Update frequency (PARTIAL_INTERVAL: 1 = every update, 2 = every other, etc.)
export const DEFAULT_UPDATE_FREQUENCY = 2;

// Media delay in milliseconds
export const DEFAULT_DELAY_MS = 0;

// Settings storage
export interface StorageSettings {
  chunkDurationSec?: number;
  asrProvider?: AsrProvider;
  translator?: TranslatorType;
  targetLang?: TargetLanguage;
  sourceLang?: SourceLanguage;
  aggressiveness?: number;
  updateFrequency?: number;
  delayMs?: number;
}

export const DEFAULT_CHUNK_DURATION_SEC = 0.32;

// WebSocket message from backend (loosely typed; dispatched by data.type in background.ts)
export interface WebSocketMessage {
  type: string;
  speaker?: string;
  text?: string;
  delta?: string;
  generation?: number;
  elapsed_ms?: number;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
}
