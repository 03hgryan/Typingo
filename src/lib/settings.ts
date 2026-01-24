// settings.ts - Chrome storage helpers
import { DEFAULT_CHUNK_DURATION_SEC, type StorageSettings } from "./types";

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
