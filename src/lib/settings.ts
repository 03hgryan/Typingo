// settings.ts - Chrome storage helpers
import { DEFAULT_CHUNK_DURATION_SEC, DEFAULT_ASR_PROVIDER, type StorageSettings, type AsrProvider } from "./types";

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
