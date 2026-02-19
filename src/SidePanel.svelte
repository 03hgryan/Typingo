<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { AsrProvider, TranslatorType, TargetLanguage, SourceLanguage } from "./lib/types";

  let isCapturing = $state(false);
  let errorMessage = $state<string | null>(null);
  let diarization = $state(false);
  let selectedTranslator = $state<TranslatorType>("deepl");
  let selectedSourceLang = $state<SourceLanguage>("en");
  let selectedLang = $state<TargetLanguage>("Korean");
  let selectedAggressiveness = $state(1);
  let selectedUpdateFrequency = $state(2);
  let selectedDelayMs = $state(0);

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

  const targetLanguages = [
    "Acehnese",
    "Afrikaans",
    "Albanian",
    "Arabic",
    "Aragonese",
    "Armenian",
    "Assamese",
    "Aymara",
    "Azerbaijani",
    "Bashkir",
    "Basque",
    "Belarusian",
    "Bengali",
    "Bhojpuri",
    "Bosnian",
    "Breton",
    "Bulgarian",
    "Burmese",
    "Cantonese",
    "Catalan",
    "Cebuano",
    "Chinese (Simplified)",
    "Chinese (Traditional)",
    "Croatian",
    "Czech",
    "Danish",
    "Dari",
    "Dutch",
    "English",
    "English (British)",
    "Esperanto",
    "Estonian",
    "Finnish",
    "French",
    "Galician",
    "Georgian",
    "German",
    "Greek",
    "Guarani",
    "Gujarati",
    "Haitian Creole",
    "Hausa",
    "Hebrew",
    "Hindi",
    "Hungarian",
    "Icelandic",
    "Igbo",
    "Indonesian",
    "Irish",
    "Italian",
    "Japanese",
    "Javanese",
    "Kapampangan",
    "Kazakh",
    "Konkani",
    "Korean",
    "Kurdish (Kurmanji)",
    "Kurdish (Sorani)",
    "Kyrgyz",
    "Latin",
    "Latvian",
    "Lingala",
    "Lithuanian",
    "Lombard",
    "Luxembourgish",
    "Macedonian",
    "Maithili",
    "Malagasy",
    "Malay",
    "Malayalam",
    "Maltese",
    "Maori",
    "Marathi",
    "Mongolian",
    "Nepali",
    "Norwegian",
    "Occitan",
    "Oromo",
    "Pangasinan",
    "Pashto",
    "Persian",
    "Polish",
    "Portuguese (Brazilian)",
    "Portuguese (European)",
    "Punjabi",
    "Quechua",
    "Romanian",
    "Russian",
    "Sanskrit",
    "Serbian",
    "Sesotho",
    "Sicilian",
    "Slovak",
    "Slovenian",
    "Spanish",
    "Spanish (Latin American)",
    "Sundanese",
    "Swahili",
    "Swedish",
    "Tagalog",
    "Tajik",
    "Tamil",
    "Tatar",
    "Telugu",
    "Thai",
    "Tsonga",
    "Tswana",
    "Turkish",
    "Turkmen",
    "Ukrainian",
    "Urdu",
    "Uzbek",
    "Vietnamese",
    "Welsh",
    "Wolof",
    "Xhosa",
    "Yiddish",
    "Zulu",
  ];

  // Migrate old stored target language names to new names
  const targetLangAliases: Record<string, string> = {
    "Chinese": "Chinese (Simplified)",
  };

  // Maps source language code → target name(s) it overlaps with (same language)
  const sourceCodeToTargetNames: Record<string, string[]> = {
    ar: ["Arabic"],
    ba: ["Bashkir"],
    eu: ["Basque"],
    be: ["Belarusian"],
    bn: ["Bengali"],
    bg: ["Bulgarian"],
    yue: ["Cantonese", "Chinese (Simplified)", "Chinese (Traditional)"],
    ca: ["Catalan"],
    hr: ["Croatian"],
    cs: ["Czech"],
    da: ["Danish"],
    nl: ["Dutch"],
    en: ["English", "English (British)"],
    eo: ["Esperanto"],
    et: ["Estonian"],
    fi: ["Finnish"],
    fr: ["French"],
    gl: ["Galician"],
    de: ["German"],
    el: ["Greek"],
    he: ["Hebrew"],
    hi: ["Hindi"],
    hu: ["Hungarian"],
    id: ["Indonesian"],
    ga: ["Irish"],
    it: ["Italian"],
    ja: ["Japanese"],
    ko: ["Korean"],
    lv: ["Latvian"],
    lt: ["Lithuanian"],
    ms: ["Malay"],
    en_ms: ["Malay", "English", "English (British)"],
    mt: ["Maltese"],
    cmn: ["Chinese (Simplified)", "Chinese (Traditional)"],
    cmn_en: ["Chinese (Simplified)", "Chinese (Traditional)", "English", "English (British)"],
    cmn_en_ms_ta: ["Chinese (Simplified)", "Chinese (Traditional)", "English", "English (British)", "Malay", "Tamil"],
    mr: ["Marathi"],
    mn: ["Mongolian"],
    no: ["Norwegian"],
    fa: ["Persian"],
    pl: ["Polish"],
    pt: ["Portuguese (Brazilian)", "Portuguese (European)"],
    ro: ["Romanian"],
    ru: ["Russian"],
    sk: ["Slovak"],
    sl: ["Slovenian"],
    es: ["Spanish", "Spanish (Latin American)"],
    sw: ["Swahili"],
    sv: ["Swedish"],
    tl: ["Tagalog"],
    ta: ["Tamil"],
    en_ta: ["Tamil", "English", "English (British)"],
    th: ["Thai"],
    tr: ["Turkish"],
    uk: ["Ukrainian"],
    ur: ["Urdu"],
    vi: ["Vietnamese"],
    cy: ["Welsh"],
  };

  // Reverse: target name → source codes that overlap
  const targetNameToSourceCodes: Record<string, string[]> = {};
  for (const [code, names] of Object.entries(sourceCodeToTargetNames)) {
    for (const name of names) {
      if (!targetNameToSourceCodes[name]) targetNameToSourceCodes[name] = [];
      targetNameToSourceCodes[name].push(code);
    }
  }

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

  function onDiarizationChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    const provider: AsrProvider = checked ? "speechmatics" : "elevenlabs";
    chrome.runtime.sendMessage({ type: "SET_ASR_PROVIDER", provider }, (response) => {
      if (response?.success) {
        diarization = checked;
      }
    });
  }

  function onTranslatorChange(e: Event) {
    const translator = (e.target as HTMLSelectElement).value as TranslatorType;
    chrome.runtime.sendMessage({ type: "SET_TRANSLATOR", translator }, (response) => {
      if (response?.success) {
        selectedTranslator = translator;
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

  function onAggressivenessChange(e: Event) {
    const aggressiveness = Number((e.target as HTMLSelectElement).value);
    chrome.runtime.sendMessage({ type: "SET_AGGRESSIVENESS", aggressiveness }, (response) => {
      if (response?.success) {
        selectedAggressiveness = aggressiveness;
      }
    });
  }

  function onUpdateFrequencyChange(e: Event) {
    const updateFrequency = Number((e.target as HTMLSelectElement).value);
    chrome.runtime.sendMessage({ type: "SET_UPDATE_FREQUENCY", updateFrequency }, (response) => {
      if (response?.success) {
        selectedUpdateFrequency = updateFrequency;
      }
    });
  }

  function onDelayMsChange(e: Event) {
    const delayMs = Number((e.target as HTMLSelectElement).value);
    chrome.runtime.sendMessage({ type: "SET_DELAY_MS", delayMs }, (response) => {
      if (response?.success) {
        selectedDelayMs = delayMs;
      }
    });
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
        diarization = response.provider === "speechmatics";
      }
    });

    chrome.runtime.sendMessage({ type: "GET_TRANSLATOR" }, (response) => {
      if (response?.translator) {
        selectedTranslator = response.translator;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_TARGET_LANG" }, (response) => {
      if (response?.lang) {
        const resolved = targetLangAliases[response.lang] ?? response.lang;
        if (resolved !== response.lang) {
          chrome.runtime.sendMessage({ type: "SET_TARGET_LANG", lang: resolved });
        }
        selectedLang = resolved;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_SOURCE_LANG" }, (response) => {
      if (response?.lang) {
        selectedSourceLang = response.lang;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_AGGRESSIVENESS" }, (response) => {
      if (response?.aggressiveness != null) {
        selectedAggressiveness = response.aggressiveness;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_UPDATE_FREQUENCY" }, (response) => {
      if (response?.updateFrequency != null) {
        selectedUpdateFrequency = response.updateFrequency;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_DELAY_MS" }, (response) => {
      if (response?.delayMs != null) {
        selectedDelayMs = response.delayMs;
      }
    });
  });
</script>

<div class="container">
  <header>
    <h1>Settings</h1>
    <span class="status" class:active={isCapturing}>
      {isCapturing ? "● Recording" : "○ Idle"}
    </span>
  </header>

  <div class="setting-row">
    <label for="diarization">Diarization</label>
    <label class="toggle">
      <input type="checkbox" id="diarization" checked={diarization} onchange={onDiarizationChange} disabled={isCapturing} />
      <span class="slider"></span>
    </label>
  </div>

  {#if diarization}
    <div class="setting-row">
      <label for="sourceLang">Source</label>
      <select id="sourceLang" value={selectedSourceLang} onchange={onSourceLangChange} disabled={isCapturing}>
        {#each sourceLanguages as lang}
          <option value={lang.code} disabled={sourceCodeToTargetNames[lang.code]?.includes(selectedLang)}>{lang.name}</option>
        {/each}
      </select>
    </div>
  {/if}

  <div class="setting-row">
    <label for="targetLang">Target</label>
    <select id="targetLang" value={selectedLang} onchange={onLangChange} disabled={isCapturing}>
      {#each targetLanguages as lang}
        <option value={lang} disabled={targetNameToSourceCodes[lang]?.includes(selectedSourceLang)}>{lang}</option>
      {/each}
    </select>
  </div>

  <div class="setting-row">
    <label for="translator">Translation Quality</label>
    <select id="translator" value={selectedTranslator} onchange={onTranslatorChange} disabled={isCapturing}>
      <option value="deepl">Quality</option>
      <option value="realtime">Speed</option>
    </select>
  </div>

  <div class="setting-row">
    <label for="aggressiveness">Speed</label>
    <select id="aggressiveness" value={selectedAggressiveness} onchange={onAggressivenessChange} disabled={isCapturing}>
      <option value={1}>High (faster, less accurate)</option>
      <option value={2}>Low (slower, more accurate)</option>
    </select>
  </div>

  <div class="setting-row">
    <label for="updateFreq">Frequency</label>
    <select id="updateFreq" value={selectedUpdateFrequency} onchange={onUpdateFrequencyChange} disabled={isCapturing}>
      <option value={1}>Every update</option>
      <option value={2}>Every 2nd update</option>
      <option value={3}>Every 3rd update</option>
      <option value={4}>Every 4th update</option>
    </select>
  </div>

  <div class="setting-row">
    <label for="delayMs">Delay</label>
    <select id="delayMs" value={selectedDelayMs} onchange={onDelayMsChange} disabled={isCapturing}>
      <option value={0}>No delay</option>
      <option value={2000}>2 seconds</option>
      <option value={3000}>3 seconds</option>
      <option value={5000}>5 seconds</option>
      <option value={7000}>7 seconds</option>
      <option value={10000}>10 seconds</option>
    </select>
  </div>

  {#if errorMessage}
    <div class="error">
      <span>{errorMessage}</span>
      <button onclick={clearError}>×</button>
    </div>
  {/if}

  <!-- Transcript (collapsible) -->
  <details class="section-details">
    <summary>Transcript</summary>
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
  </details>

  <!-- Translation (collapsible) -->
  <details class="section-details">
    <summary>Translation</summary>
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
  </details>

  <!-- Raw Transcript -->
  <details class="section-details">
    <summary>Raw transcript</summary>
    <p class="raw-text">{transcript || "—"}</p>
  </details>
</div>

<style>
  .container {
    padding: 16px;
    font-family: "Inter", system-ui, sans-serif;
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
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .setting-row label {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .setting-row select {
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

  .setting-row select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    margin-left: auto;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #333;
    border-radius: 22px;
    transition: 0.2s;
  }

  .slider::before {
    content: "";
    position: absolute;
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background: #888;
    border-radius: 50%;
    transition: 0.2s;
  }

  .toggle input:checked + .slider {
    background: #1d4ed8;
  }

  .toggle input:checked + .slider::before {
    transform: translateX(18px);
    background: #fff;
  }

  .toggle input:disabled + .slider {
    opacity: 0.4;
    cursor: not-allowed;
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

  .section-details {
    margin-top: 16px;
    font-size: 0.85rem;
    color: #888;
  }

  .section-details summary {
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
  }

  .section-details summary:hover {
    color: #aaa;
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
    margin-top: 8px;
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
    margin-top: 8px;
  }

  .confirmed-transcript { color: #8ab4f8; }
  .partial-transcript { color: #4a7ab5; }
  .placeholder { color: #333; font-style: italic; }
  .confirmed { color: #e2e8f0; }
  .partial { color: #64748b; }

  .raw-text {
    background: #111;
    border-radius: 8px;
    padding: 12px;
    margin-top: 8px;
    line-height: 1.5;
  }
</style>
