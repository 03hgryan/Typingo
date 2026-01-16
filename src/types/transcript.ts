// types/transcript.ts
/**
 * Types matching the new backend schema.
 *
 * Key concepts:
 * - WordInfo: A single word with timing and confidence
 * - LiveSegment: Real-time updates (stable + unstable words)
 * - FinalizedSegment: Immutable, append-only history
 */

// === Word-level types ===

export interface WordInfo {
  word: string;
  start_ms: number;
  end_ms: number;
  probability: number;
}

// === Segment types ===

/**
 * Live segment - updates in real-time, may change.
 *
 * Backend sends this via "segments_update" message.
 */
export interface LiveSegment {
  segment_id: string;
  revision: number;

  // Structured word data (authoritative)
  stable_words: WordInfo[];
  unstable_words: WordInfo[];

  // Convenience rendering (for simple display)
  committed: string; // rendered_text.stable
  partial: string; // rendered_text.unstable

  final: boolean;
}

/**
 * Finalized segment - immutable, append-only.
 *
 * Backend sends this via "segments_finalized" message.
 */
export interface FinalizedSegment {
  segment_id: string;
  segment_index: number;
  text: string;
  words: WordInfo[];
  final: boolean;
}

// === Message types from backend ===

export interface SegmentsUpdateMessage {
  type: "segments_update";
  segments: LiveSegment[];
}

export interface SegmentsFinalizedMessage {
  type: "segments_finalized";
  segments: FinalizedSegment[];
}

export interface TranscriptFinalMessage {
  type: "transcript_final";
  transcript: string;
  words: WordInfo[];
  segments: FinalizedSegment[];
}

export type BackendMessage = SegmentsUpdateMessage | SegmentsFinalizedMessage | TranscriptFinalMessage;
