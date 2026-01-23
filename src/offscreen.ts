// offscreen.ts - Handles audio capture in the background
console.log("Offscreen document loaded");

let audioContext: AudioContext | null = null;
let workletNode: AudioWorkletNode | null = null;
let mediaStream: MediaStream | null = null;

async function startCapture(streamId: string) {
  try {
    console.log("Starting audio capture with stream ID:", streamId);

    // Get the media stream using the stream ID
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error - Chrome-specific constraint
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    audioContext = new AudioContext({ sampleRate: 48000 });

    // Load audioWorklet - need to fetch from extension URL
    const workletUrl = chrome.runtime.getURL("public/audioWorklet.js");
    await audioContext.audioWorklet.addModule(workletUrl);

    const source = audioContext.createMediaStreamSource(mediaStream);

    workletNode = new AudioWorkletNode(audioContext, "audio-worklet");

    workletNode.port.onmessage = (e) => {
      const chunk = e.data;
      // Send audio chunks to background script
      chrome.runtime.sendMessage({
        type: "AUDIO_CHUNK",
        chunk: {
          pcm: Array.from(chunk.pcm),
          chunk_index: chunk.chunk_index,
          duration_ms: chunk.duration_ms,
        },
      });
    };

    // Connect to worklet for processing
    source.connect(workletNode);

    // IMPORTANT: Connect to destination to play audio through speakers
    // When capturing tab audio, we take exclusive control - must pipe it back for playback
    source.connect(audioContext.destination);

    console.log("Audio capture started successfully in offscreen document");

    // Notify background that capture started
    chrome.runtime.sendMessage({ type: "OFFSCREEN_CAPTURE_STARTED" });
  } catch (error) {
    console.error("Failed to start audio capture:", error);
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_CAPTURE_ERROR",
      error: String(error)
    });
  }
}

function stopCapture() {
  console.log("Stopping audio capture in offscreen document");

  if (workletNode) {
    workletNode.disconnect();
    workletNode.port.onmessage = null;
    workletNode = null;
  }

  mediaStream?.getTracks().forEach((t) => t.stop());
  mediaStream = null;

  audioContext?.close();
  audioContext = null;

  chrome.runtime.sendMessage({ type: "OFFSCREEN_CAPTURE_STOPPED" });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "START_OFFSCREEN_CAPTURE") {
    startCapture(message.streamId);
  }

  if (message.type === "STOP_OFFSCREEN_CAPTURE") {
    stopCapture();
  }
});
