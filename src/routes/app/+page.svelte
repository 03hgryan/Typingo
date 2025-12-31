<script lang="ts">
  import { onMount } from "svelte";
  import { AudioCapture } from "../../audio/audioCapture";
  import type { FinalizedSegment, LiveSegment } from "../../types/transcript";

  let isCapturing = $state(false);

  // Production-level state separation (critical!)
  let finalizedSegments = $state<FinalizedSegment[]>([]); // Immutable history
  let liveSegment = $state<LiveSegment | null>(null); // Mutable active segment

  let logs = $state<string[]>([]);
  let capture: AudioCapture | null = null;

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, `[${timestamp}] ${message}`];
  }

  async function toggleCapture() {
    addLog("🔘 Button clicked! isCapturing: " + isCapturing);

    if (!isCapturing) {
      // START: Capture tab audio
      try {
        addLog("🎤 Creating AudioCapture...");

        capture = new AudioCapture((chunk) => {
          addLog(`🎵 Chunk received: ${chunk.pcm?.length || 'undefined'} samples`);

          // Convert Int16Array to regular array for Chrome messaging
          const chunkData = {
            pcm: Array.from(chunk.pcm),
            chunk_index: chunk.chunk_index,
            duration_ms: chunk.duration_ms,
          };

          // Send audio chunks to background
          chrome.runtime.sendMessage({
            type: "AUDIO_CHUNK",
            chunk: chunkData,
          });
        });

        addLog("📡 Connecting WebSocket...");
        chrome.runtime.sendMessage({ type: "CONNECT_WS" });

        addLog("🎙️ Starting tab audio capture...");
        await capture.start();

        isCapturing = true;
        addLog("✅ Audio capture started!");
      } catch (error) {
        addLog("❌ Failed: " + error);
      }
    } else {
      // STOP: Stop capture
      addLog("⏹️ Stopping...");

      if (capture) {
        capture.stop();
        capture = null;
      }

      chrome.runtime.sendMessage({ type: "DISCONNECT_WS" });

      isCapturing = false;
      addLog("✅ Stopped");
    }
  }

  onMount(() => {
    addLog("✅ Popup ready");

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
      // Handle live segment updates (mutable)
      if (message.type === "SEGMENTS_UPDATE") {
        const seg = message.payload.segments[0] as LiveSegment;

        // Always replace live segment (never append)
        liveSegment = seg;

        addLog(`⏳ Live: "${seg.committed}${seg.partial}" (rev ${seg.revision})`);

        // Debug logging
        console.log("LIVE:", liveSegment);
      }

      // Handle finalized segments (immutable)
      if (message.type === "SEGMENTS_FINALIZED") {
        const finalized = message.payload.segments[0] as FinalizedSegment;

        // Append-only (never update existing)
        finalizedSegments = [...finalizedSegments, finalized];

        addLog(`✅ Final [${finalized.segment_index}]: "${finalized.text}"`);

        // Clear live segment if it belongs to this finalized segment
        if (liveSegment?.segment_id === finalized.segment_id) {
          liveSegment = null;
        }

        // Debug logging
        console.log("FINAL:", finalizedSegments.map((s) => s.text));
      }

      if (message.type === "WS_CONNECTED") {
        addLog("✅ WebSocket connected");
      }

      if (message.type === "WS_DISCONNECTED") {
        addLog("🔌 WebSocket disconnected");

        // Clear state on disconnect
        finalizedSegments = [];
        liveSegment = null;
      }
    });
  });
</script>

<div class="container">
  <h1>AST - Tab Audio Capture</h1>

  <button class="capture-btn" class:active={isCapturing} onclick={toggleCapture}>
    {isCapturing ? "⏹️ Stop Capture" : "🎤 Start Capture"}
  </button>

  <div class="logs-container">
    <h2>Debug Logs</h2>
    <div class="logs">
      {#if logs.length === 0}
        <p class="empty-log">No logs yet...</p>
      {:else}
        {#each logs as log}
          <div class="log-entry">{log}</div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="transcript-container">
    <h2>Transcript</h2>

    {#if finalizedSegments.length === 0 && !liveSegment}
      <p class="empty">Waiting for audio...</p>
    {:else}
      <div class="transcript">
        <!-- Finalized segments (immutable history) -->
        {#each finalizedSegments as segment (segment.segment_index)}
          <div class="segment finalized">
            <span class="segment-badge">#{segment.segment_index}</span>
            <span class="text">{segment.text}</span>
          </div>
        {/each}

        <!-- Live segment (mutable, real-time) -->
        {#if liveSegment}
          <div class="segment live">
            <span class="segment-badge live">⏳</span>
            <span class="text">
              <span class="committed">{liveSegment.committed}</span>
              <span class="partial">{liveSegment.partial}</span>
            </span>
          </div>
        {/if}
      </div>

      <!-- Full transcript export view -->
      <div class="full-transcript">
        <h3>Full Transcript</h3>
        <div class="transcript-text">
          {finalizedSegments.map((s) => s.text).join(" ")}
          {#if liveSegment}
            {liveSegment.committed}{liveSegment.partial}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    padding: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    width: 400px;
  }

  h1 {
    color: #2c3e50;
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }

  h2 {
    color: #34495e;
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .capture-btn {
    width: 100%;
    padding: 12px;
    font-size: 16px;
    font-weight: 600;
    border: 2px solid #3498db;
    background: white;
    color: #3498db;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1rem;
  }

  .capture-btn:hover {
    background: #3498db;
    color: white;
  }

  .capture-btn.active {
    background: #e74c3c;
    border-color: #e74c3c;
    color: white;
  }

  .logs-container {
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: #f8f9fa;
  }

  .logs {
    max-height: 200px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .log-entry {
    padding: 2px 0;
    color: #2c3e50;
    border-bottom: 1px solid #ecf0f1;
  }

  .empty-log {
    color: #95a5a6;
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  /* Transcript container */
  .transcript-container {
    border-top: 1px solid #ecf0f1;
    padding-top: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .transcript {
    background: white;
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .empty {
    color: #95a5a6;
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  /* Segment styles */
  .segment {
    padding: 0.5rem 0;
    line-height: 1.6;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .segment-badge {
    background: #27ae60;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: monospace;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .segment-badge.live {
    background: #f39c12;
  }

  /* Finalized segments - solid, immutable */
  .segment.finalized .text {
    color: #2c3e50;
    font-weight: 500;
  }

  /* Live segment - mutable */
  .segment.live {
    background: #fffbf0;
    padding: 0.75rem;
    border-radius: 6px;
    border-left: 3px solid #f39c12;
  }

  /* Committed text - stable within live segment */
  .committed {
    color: #2c3e50;
    font-weight: 500;
  }

  /* Partial text - unstable, can change */
  .partial {
    color: #7f8c8d;
    font-style: italic;
    opacity: 0.8;
  }

  /* Full transcript export view */
  .full-transcript {
    background: #f8f9fa;
    border: 1px solid #ecf0f1;
    border-radius: 8px;
    padding: 1rem;
  }

  .full-transcript h3 {
    color: #34495e;
    font-size: 0.9rem;
    margin: 0 0 0.5rem 0;
  }

  .transcript-text {
    color: #2c3e50;
    line-height: 1.8;
    font-size: 0.9rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
