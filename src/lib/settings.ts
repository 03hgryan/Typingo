// settings.ts - Chrome storage helpers
import { DEFAULT_CHUNK_DURATION_SEC, DEFAULT_ASR_PROVIDER, DEFAULT_TRANSLATOR, DEFAULT_TARGET_LANG, DEFAULT_SOURCE_LANG, DEFAULT_AGGRESSIVENESS, DEFAULT_UPDATE_FREQUENCY, DEFAULT_DELAY_MS, type StorageSettings, type AsrProvider, type TranslatorType, type TargetLanguage, type SourceLanguage } from "./types";

export async function getUserId(): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    chrome.storage.local.get(["userId"], (result: StorageSettings) => {
      resolve(result.userId);
    });
  });
}

export async function setUserId(userId: string): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ userId }, () => resolve());
  });
}

export async function getChunkDuration(): Promise<number> {
  return new Promise<number>((resolve) => {
    chrome.storage.local.get(["chunkDurationSec"], (result: StorageSettings) => {
      resolve(result.chunkDurationSec ?? DEFAULT_CHUNK_DURATION_SEC);
    });
  });
}

export async function setChunkDuration(seconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ chunkDurationSec: seconds }, () => resolve());
  });
}

export async function getAsrProvider(): Promise<AsrProvider> {
  return new Promise<AsrProvider>((resolve) => {
    chrome.storage.local.get(["asrProvider"], (result: StorageSettings) => {
      resolve(result.asrProvider ?? DEFAULT_ASR_PROVIDER);
    });
  });
}

export async function setAsrProvider(provider: AsrProvider): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ asrProvider: provider }, () => resolve());
  });
}

export async function getTargetLang(): Promise<TargetLanguage> {
  return new Promise<TargetLanguage>((resolve) => {
    chrome.storage.local.get(["targetLang"], (result: StorageSettings) => {
      resolve(result.targetLang ?? DEFAULT_TARGET_LANG);
    });
  });
}

export async function setTargetLang(lang: TargetLanguage): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ targetLang: lang }, () => resolve());
  });
}

export async function getSourceLang(): Promise<SourceLanguage> {
  return new Promise<SourceLanguage>((resolve) => {
    chrome.storage.local.get(["sourceLang"], (result: StorageSettings) => {
      resolve(result.sourceLang ?? DEFAULT_SOURCE_LANG);
    });
  });
}

export async function setSourceLang(lang: SourceLanguage): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ sourceLang: lang }, () => resolve());
  });
}

export async function getTranslator(): Promise<TranslatorType> {
  return new Promise<TranslatorType>((resolve) => {
    chrome.storage.local.get(["translator"], (result: StorageSettings) => {
      resolve(result.translator ?? DEFAULT_TRANSLATOR);
    });
  });
}

export async function setTranslator(translator: TranslatorType): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ translator }, () => resolve());
  });
}

export async function getAggressiveness(): Promise<number> {
  return new Promise<number>((resolve) => {
    chrome.storage.local.get(["aggressiveness"], (result: StorageSettings) => {
      resolve(result.aggressiveness ?? DEFAULT_AGGRESSIVENESS);
    });
  });
}

export async function setAggressiveness(aggressiveness: number): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ aggressiveness }, () => resolve());
  });
}

export async function getUpdateFrequency(): Promise<number> {
  return new Promise<number>((resolve) => {
    chrome.storage.local.get(["updateFrequency"], (result: StorageSettings) => {
      resolve(result.updateFrequency ?? DEFAULT_UPDATE_FREQUENCY);
    });
  });
}

export async function setUpdateFrequency(updateFrequency: number): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ updateFrequency }, () => resolve());
  });
}

export async function getDelayMs(): Promise<number> {
  return new Promise<number>((resolve) => {
    chrome.storage.local.get(["delayMs"], (result: StorageSettings) => {
      resolve(result.delayMs ?? DEFAULT_DELAY_MS);
    });
  });
}

export async function setDelayMs(delayMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ delayMs }, () => resolve());
  });
}

export async function getAuthToken(): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    chrome.storage.local.get(["authToken"], (result: StorageSettings) => {
      resolve(result.authToken);
    });
  });
}

export async function setAuthData(token: string, name?: string, email?: string, picture?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ authToken: token, userName: name, userEmail: email, userPicture: picture }, () => resolve());
  });
}

export async function getAuthState(): Promise<{ authToken?: string; userName?: string; userEmail?: string; userPicture?: string }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["authToken", "userName", "userEmail", "userPicture"], (result: StorageSettings) => {
      resolve({
        authToken: result.authToken,
        userName: result.userName,
        userEmail: result.userEmail,
        userPicture: result.userPicture,
      });
    });
  });
}

export async function clearAuth(): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.remove(["authToken", "userName", "userEmail", "userPicture"], () => resolve());
  });
}

