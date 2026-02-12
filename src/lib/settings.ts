// settings.ts - Chrome storage helpers
import { DEFAULT_CHUNK_DURATION_SEC, DEFAULT_ASR_PROVIDER, DEFAULT_TARGET_LANG, DEFAULT_SOURCE_LANG, type StorageSettings, type AsrProvider, type TargetLanguage, type SourceLanguage } from "./types";

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
