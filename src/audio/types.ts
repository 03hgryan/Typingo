export interface AudioChunk {
  pcm: Int16Array;
  start_time_ms: number;
  duration_ms: number;
}
