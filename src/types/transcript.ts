/**
 * TypeScript types for production-level transcript management.
 *
 * Implements the two-layer model:
 * - FinalizedSegment: Immutable history (Layer 3 from backend)
 * - LiveSegment: Mutable active segment (Layer 2 from backend)
 */

/**
 * Finalized segment - IMMUTABLE, append-only.
 * Received via segments_finalized message.
 */
export interface FinalizedSegment {
  segment_index: number; // Monotonic index for stable ordering
  segment_id: string; // Unique identifier
  text: string; // Complete finalized text
  timestamp_ms: number; // Wall-clock timestamp
  final: true; // Always true for finalized segments
}

/**
 * Live segment - MUTABLE, can change.
 * Received via segments_update message.
 */
export interface LiveSegment {
  segment_id: string; // Current segment identifier
  committed: string; // Stable prefix (won't change within this segment)
  partial: string; // Unstable suffix (can change)
  revision: number; // Hypothesis number
  final: false; // Always false for live segments
}

/**
 * WebSocket message types from backend.
 */
export type SegmentsUpdateMessage = {
  type: "segments_update";
  segments: [LiveSegment]; // Always single live segment
};

export type SegmentsFinalizedMessage = {
  type: "segments_finalized";
  segments: [FinalizedSegment]; // Always single finalized segment
};

export type TranscriptMessage = SegmentsUpdateMessage | SegmentsFinalizedMessage;
