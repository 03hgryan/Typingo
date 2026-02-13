<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { AsrProvider, TargetLanguage, SourceLanguage } from "./lib/types";

  let isCapturing = $state(false);
  let errorMessage = $state<string | null>(null);
  let selectedProvider = $state<AsrProvider>("elevenlabs");
  let selectedLang = $state<TargetLanguage>("Korean");
  let selectedSourceLang = $state<SourceLanguage>("en");

  let transcript = $state("");
  let confirmedTranscript = $state("");
  let partialTranscriptText = $state("");
  let confirmedTranslation = $state("");
  let partialTranslation = $state("");
  let transcriptBox: HTMLDivElement;
  let translationBox: HTMLDivElement;

  const sourceLanguages: { code: string; name: string }[] = [
    { code: "ar", name: "Arabic" },
    { code: "ba", name: "Bashkir" },
    { code: "eu", name: "Basque" },
    { code: "be", name: "Belarusian" },
    { code: "bn", name: "Bengali" },
    { code: "bg", name: "Bulgarian" },
    { code: "yue", name: "Cantonese" },
    { code: "ca", name: "Catalan" },
    { code: "hr", name: "Croatian" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "eo", name: "Esperanto" },
    { code: "et", name: "Estonian" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "gl", name: "Galician" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" },
    { code: "hu", name: "Hungarian" },
    { code: "id", name: "Indonesian" },
    { code: "ia", name: "Interlingua" },
    { code: "ga", name: "Irish" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "lv", name: "Latvian" },
    { code: "lt", name: "Lithuanian" },
    { code: "ms", name: "Malay" },
    { code: "en_ms", name: "Malay & English" },
    { code: "mt", name: "Maltese" },
    { code: "cmn", name: "Mandarin" },
    { code: "cmn_en", name: "Mandarin & English" },
    { code: "cmn_en_ms_ta", name: "Mandarin Malay Tamil & English" },
    { code: "mr", name: "Marathi" },
    { code: "mn", name: "Mongolian" },
    { code: "no", name: "Norwegian" },
    { code: "fa", name: "Persian" },
    { code: "pl", name: "Polish" },
    { code: "pt", name: "Portuguese" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sk", name: "Slovak" },
    { code: "sl", name: "Slovenian" },
    { code: "es", name: "Spanish" },
    { code: "sw", name: "Swahili" },
    { code: "sv", name: "Swedish" },
    { code: "tl", name: "Tagalog & English" },
    { code: "ta", name: "Tamil" },
    { code: "en_ta", name: "Tamil & English" },
    { code: "th", name: "Thai" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" },
    { code: "ug", name: "Uyghur" },
    { code: "vi", name: "Vietnamese" },
    { code: "cy", name: "Welsh" },
  ];

  const targetLanguages = ["English", "Korean", "Japanese", "Chinese", "Spanish", "French", "German"];

  // Map source codes to target language names for overlap detection
  const sourceCodeToTargetName: Record<string, string> = {
    en: "English", ko: "Korean", ja: "Japanese", cmn: "Chinese", yue: "Chinese",
    es: "Spanish", fr: "French", de: "German",
  };
  const targetNameToSourceCodes: Record<string, string[]> = {
    English: ["en"], Korean: ["ko"], Japanese: ["ja"], Chinese: ["cmn", "yue"],
    Spanish: ["es"], French: ["fr"], German: ["de"],
  };

  $effect(() => {
    confirmedTranscript;
    partialTranscriptText;
    tick().then(() => {
      if (transcriptBox) {
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
      }
    });
  });

  $effect(() => {
    confirmedTranslation;
    partialTranslation;
    tick().then(() => {
      if (translationBox) {
        translationBox.scrollTop = translationBox.scrollHeight;
      }
    });
  });

  function clearError() {
    errorMessage = null;
  }

  function resetState() {
    transcript = "";
    confirmedTranscript = "";
    partialTranscriptText = "";
    confirmedTranslation = "";
    partialTranslation = "";
  }

  function onProviderChange(e: Event) {
    const provider = (e.target as HTMLSelectElement).value as AsrProvider;
    chrome.runtime.sendMessage({ type: "SET_ASR_PROVIDER", provider }, (response) => {
      if (response?.success) {
        selectedProvider = provider;
      }
    });
  }

  function onLangChange(e: Event) {
    const lang = (e.target as HTMLSelectElement).value as TargetLanguage;
    chrome.runtime.sendMessage({ type: "SET_TARGET_LANG", lang }, (response) => {
      if (response?.success) {
        selectedLang = lang;
      }
    });
  }

  function onSourceLangChange(e: Event) {
    const lang = (e.target as HTMLSelectElement).value as SourceLanguage;
    chrome.runtime.sendMessage({ type: "SET_SOURCE_LANG", lang }, (response) => {
      if (response?.success) {
        selectedSourceLang = lang;
      }
    });
  }

  async function toggleCapture() {
    if (!isCapturing) {
      chrome.runtime.sendMessage({ type: "START_CAPTURE" }, (response) => {
        if (response?.success) {
          errorMessage = null;
          resetState();
        } else {
          errorMessage = `Failed to start: ${response?.error || "Unknown error"}`;
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, (response) => {
        if (response?.success) {
          isCapturing = false;
        }
      });
    }
  }

  onMount(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "TRANSCRIPT") {
        transcript = message.text || "";
      }

      if (message.type === "CONFIRMED_TRANSCRIPT") {
        confirmedTranscript = (confirmedTranscript ? confirmedTranscript + " " : "") + (message.text || "");
        partialTranscriptText = "";
      }

      if (message.type === "PARTIAL_TRANSCRIPT_TEXT") {
        partialTranscriptText = message.text || "";
      }

      if (message.type === "CONFIRMED_TRANSLATION") {
        confirmedTranslation = (confirmedTranslation ? confirmedTranslation + " " : "") + (message.text || "");
        partialTranslation = "";
      }

      if (message.type === "PARTIAL_TRANSLATION") {
        partialTranslation = message.text || "";
      }

      if (message.type === "CAPTURE_STARTED") {
        isCapturing = true;
        errorMessage = null;
        resetState();
      }

      if (message.type === "CAPTURE_STOPPED") {
        isCapturing = false;
      }

      if (message.type === "CAPTURE_ERROR") {
        isCapturing = false;
        errorMessage = `Capture error: ${message.error}`;
      }

      if (message.type === "WS_ERROR") {
        errorMessage = `Connection error: ${message.error}`;
      }

      if (message.type === "ERROR") {
        errorMessage = `Server error: ${message.message}`;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATE" }, (response) => {
      if (response?.isCapturing) {
        isCapturing = true;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_ASR_PROVIDER" }, (response) => {
      if (response?.provider) {
        selectedProvider = response.provider;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_TARGET_LANG" }, (response) => {
      if (response?.lang) {
        selectedLang = response.lang;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_SOURCE_LANG" }, (response) => {
      if (response?.lang) {
        selectedSourceLang = response.lang;
      }
    });
  });
</script>

<div class="container">
  <header>
    <h1>🎙️ Live Translation</h1>
    <span class="status" class:active={isCapturing}>
      {isCapturing ? "● Recording" : "○ Idle"}
    </span>
  </header>

  <div class="provider-select">
    <label for="provider">Provider</label>
    <select id="provider" value={selectedProvider} onchange={onProviderChange} disabled={isCapturing}>
      <option value="elevenlabs">ElevenLabs</option>
      <option value="speechmatics">Speechmatics</option>
    </select>
  </div>

  {#if selectedProvider === "speechmatics"}
    <div class="provider-select">
      <label for="sourceLang">Source</label>
      <select id="sourceLang" value={selectedSourceLang} onchange={onSourceLangChange} disabled={isCapturing}>
        {#each sourceLanguages as lang}
          <option value={lang.code} disabled={sourceCodeToTargetName[lang.code] === selectedLang}>{lang.name}</option>
        {/each}
      </select>
    </div>
  {/if}

  <div class="provider-select">
    <label for="targetLang">Target</label>
    <select id="targetLang" value={selectedLang} onchange={onLangChange} disabled={isCapturing}>
      {#each targetLanguages as lang}
        <option value={lang} disabled={targetNameToSourceCodes[lang]?.includes(selectedSourceLang)}>{lang}</option>
      {/each}
    </select>
  </div>

  <button class="capture-btn" class:active={isCapturing} onclick={toggleCapture}>
    {isCapturing ? "⏹ Stop" : "▶ Start"}
  </button>

  {#if errorMessage}
    <div class="error">
      <span>{errorMessage}</span>
      <button onclick={clearError}>×</button>
    </div>
  {/if}

  <!-- Transcript -->
  <div class="section">
    <div class="label">Transcript</div>
    <div class="transcript-box" bind:this={transcriptBox}>
      {#if !confirmedTranscript && !partialTranscriptText}
        <span class="placeholder">Waiting for speech...</span>
      {:else}
        <span class="confirmed-transcript">{confirmedTranscript}</span>
        {#if partialTranscriptText}
          <span class="partial-transcript"> {partialTranscriptText}</span>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Translation -->
  <div class="section">
    <div class="label">Translation</div>
    <div class="translation-box" bind:this={translationBox}>
      {#if !confirmedTranslation && !partialTranslation}
        <span class="placeholder">Waiting for speech...</span>
      {:else}
        <span class="confirmed">{confirmedTranslation}</span>
        {#if partialTranslation}
          <span class="partial"> {partialTranslation}</span>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Raw Transcript -->
  <details class="transcript-details">
    <summary>Raw transcript</summary>
    <p>{transcript || "—"}</p>
  </details>
</div>

<style>
  .container {
    padding: 16px;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    height: 100vh;
    background: #0a0a0a;
    color: #fff;
    overflow-y: auto;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 1.1rem;
    margin: 0;
    font-weight: 600;
  }

  .status {
    font-size: 0.7rem;
    color: #666;
    padding: 4px 10px;
    border-radius: 12px;
    background: #1a1a1a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status.active {
    color: #fff;
    background: #dc2626;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .provider-select {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .provider-select label {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .provider-select select {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.85rem;
    background: #1a1a1a;
    color: #fff;
    border: 1px solid #333;
    border-radius: 8px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }

  .provider-select select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .capture-btn {
    width: 100%;
    padding: 14px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
  }

  .capture-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .capture-btn.active {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  }

  .error {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.3);
    padding: 10px 14px;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 0.85rem;
    color: #fca5a5;
  }

  .error button {
    background: none;
    border: none;
    color: #fca5a5;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
  }

  .section {
    margin-top: 20px;
  }

  .label {
    font-size: 0.7rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .translation-box {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 16px;
    min-height: 120px;
    max-height: 300px;
    overflow-y: auto;
    font-size: 1.1rem;
    line-height: 1.7;
  }

  .transcript-box {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 16px;
    min-height: 80px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 0.95rem;
    line-height: 1.7;
  }

  .confirmed-transcript {
    color: #8ab4f8;
  }
  .partial-transcript {
    color: #4a7ab5;
  }

  .placeholder {
    color: #333;
    font-style: italic;
  }
  .confirmed {
    color: #e2e8f0;
  }
  .partial {
    color: #64748b;
  }

  .transcript-details {
    margin-top: 20px;
    font-size: 0.8rem;
    color: #555;
  }

  .transcript-details summary {
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
  }

  .transcript-details p {
    background: #111;
    border-radius: 8px;
    padding: 12px;
    margin-top: 8px;
    line-height: 1.5;
  }
</style>
