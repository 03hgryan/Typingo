// types.ts - Shared type definitions

export interface AudioChunk {
  pcm: Int16Array;
  chunk_index: number;
  duration_ms: number;
}

// Message types for chrome.runtime communication
export type MessageToBackground =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "GET_STATUS" }
  | { type: "AUDIO_CHUNK"; chunk: { pcm: number[]; chunk_index: number; duration_ms: number } };

export type MessageFromBackground =
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "CONNECTION_ERROR"; error: string }
  | { type: "SERVER_MESSAGE"; data: unknown };

// Settings storage
export interface StorageSettings {
  chunkDurationSec?: number;
}

export const DEFAULT_CHUNK_DURATION_SEC = 0.32;
