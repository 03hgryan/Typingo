<script lang="ts">
  import { onMount } from "svelte";

  let isCapturing = $state(false);
  let errorMessage = $state<string | null>(null);
  let isLoggedIn = $state(false);
  let userName = $state<string | undefined>(undefined);
  let userEmail = $state<string | undefined>(undefined);
  let userPicture = $state<string | undefined>(undefined);
  let authLoading = $state(false);

  function handleLogin() {
    authLoading = true;
    chrome.runtime.sendMessage({ type: "GOOGLE_LOGIN" }, (response) => {
      authLoading = false;
      if (response?.success) {
        isLoggedIn = true;
        userName = response.userName;
        userEmail = response.userEmail;
        userPicture = response.userPicture;
      } else {
        errorMessage = response?.error || "Login failed";
      }
    });
  }

  function handleLogout() {
    chrome.runtime.sendMessage({ type: "GOOGLE_LOGOUT" }, () => {
      isLoggedIn = false;
      userName = undefined;
      userEmail = undefined;
      userPicture = undefined;
    });
  }

  async function toggleCapture() {
    if (!isCapturing) {
      chrome.runtime.sendMessage({ type: "START_CAPTURE" }, (response) => {
        if (response?.success) {
          errorMessage = null;
        } else {
          errorMessage = response?.error || "Unknown error";
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

  function openSettings() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.runtime.sendMessage({ type: "TOGGLE_SIDE_PANEL", tabId });
      }
    });
  }

  onMount(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "CAPTURE_STARTED") {
        isCapturing = true;
        errorMessage = null;
      }
      if (message.type === "CAPTURE_STOPPED") {
        isCapturing = false;
      }
      if (message.type === "CAPTURE_ERROR") {
        isCapturing = false;
        errorMessage = message.error;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATE" }, (response) => {
      if (response?.isCapturing) {
        isCapturing = true;
      }
    });

    chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (response) => {
      if (response?.isLoggedIn) {
        isLoggedIn = true;
        userName = response.userName;
        userEmail = response.userEmail;
        userPicture = response.userPicture;
      }
    });
  });
</script>

<div class="popup">
  <span class="name">Typing<span class="quote">"</span>o<span class="quote">"</span></span>

  {#if isLoggedIn}
    <div class="user-info" title={userEmail}>
      {#if userPicture}
        <img class="avatar" src={userPicture} alt="" referrerpolicy="no-referrer" />
      {/if}
      <span class="user-name">{userName || userEmail}</span>
      <button class="logout-btn" onclick={handleLogout} title="Sign out">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  {:else}
    <button class="sign-in-btn" onclick={handleLogin} disabled={authLoading}>
      {authLoading ? "..." : "Sign in"}
    </button>
  {/if}

  <span class="status" class:active={isCapturing}>
    {isCapturing ? "Live" : "Idle"}
  </span>
  <button
    class="start-btn"
    class:active={isCapturing}
    onclick={toggleCapture}
    disabled={!isLoggedIn && !isCapturing}
    title={!isLoggedIn ? "Sign in to start" : ""}
  >
    {isCapturing ? "Stop" : "Start"}
  </button>
  <button class="settings-btn" onclick={openSettings} title="Settings">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </svg>
  </button>
</div>

{#if errorMessage}
  <div class="error">{errorMessage}</div>
{/if}

<style>
  .popup {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    font-family: "Inter", system-ui, sans-serif;
    background: #0a0a0a;
    color: #fff;
    white-space: nowrap;
  }

  .name {
    font-weight: 850;
    font-size: 1rem;
    letter-spacing: -0.5px;
  }

  .quote {
    font-weight: 500;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }

  .user-name {
    font-size: 0.7rem;
    color: #aaa;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: transparent;
    color: #666;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    color: #ef4444;
  }

  .sign-in-btn {
    margin-left: auto;
    padding: 4px 10px;
    font-size: 0.7rem;
    font-weight: 600;
    border: 1px solid #333;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    background: #1a1a1a;
    color: #ccc;
  }

  .sign-in-btn:hover {
    background: #222;
    color: #fff;
  }

  .sign-in-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: #1a1a1a;
    color: #666;
    border: 1px solid #333;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .settings-btn:hover {
    background: #222;
    color: #aaa;
  }

  .start-btn {
    padding: 5px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    background: #1d4ed8;
    color: white;
  }

  .start-btn:hover {
    background: #2563eb;
  }

  .start-btn.active {
    background: #dc2626;
  }

  .start-btn.active:hover {
    background: #ef4444;
  }

  .start-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .status {
    font-weight: 400;
    font-size: 0.65rem;
    color: #666;
    padding: 3px 8px;
    border-radius: 10px;
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

  .error {
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.3);
    padding: 6px 14px;
    font-size: 0.75rem;
    color: #fca5a5;
    font-family: "Inter", system-ui, sans-serif;
  }
</style>
