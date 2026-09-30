import * as SecureStore from "expo-secure-store";

export const SECURE_STORE_CHUNK_SIZE = 1800;
export const MAX_SECURE_STORE_CHUNKS = 128;

const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

type SecureStoreApi = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

function encodeStorageKey(key: string) {
  let encoded = "";

  for (let index = 0; index < key.length; index += 1) {
    encoded += key.charCodeAt(index).toString(16).padStart(4, "0");
  }

  return encoded || "empty";
}

export function getSecureStoreCountKey(key: string) {
  return `mem2.${encodeStorageKey(key)}.count`;
}

export function getSecureStoreChunkKey(key: string, index: number) {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error("SecureStore chunk index must be a non-negative integer.");
  }

  return `mem2.${encodeStorageKey(key)}.chunk.${index}`;
}

function splitIntoChunks(value: string) {
  if (value.length === 0) return [""];

  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += SECURE_STORE_CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + SECURE_STORE_CHUNK_SIZE));
  }
  return chunks;
}

function parseChunkCount(value: string | null) {
  if (value == null) return 0;

  const count = Number(value);
  return Number.isSafeInteger(count) &&
    count > 0 &&
    count <= MAX_SECURE_STORE_CHUNKS
    ? count
    : 0;
}

export function createChunkedSecureStore(store: SecureStoreApi = SecureStore) {
  return {
    async getItem(key: string) {
      const count = parseChunkCount(
        await store.getItemAsync(getSecureStoreCountKey(key)),
      );
      if (count === 0) return null;

      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          store.getItemAsync(getSecureStoreChunkKey(key, index)),
        ),
      );

      return chunks.every((chunk) => chunk != null) ? chunks.join("") : null;
    },

    async setItem(key: string, value: string) {
      const countKey = getSecureStoreCountKey(key);
      const previousCount = parseChunkCount(await store.getItemAsync(countKey));
      const chunks = splitIntoChunks(value);

      await Promise.all(
        chunks.map((chunk, index) =>
          store.setItemAsync(getSecureStoreChunkKey(key, index), chunk),
        ),
      );
      await store.setItemAsync(countKey, String(chunks.length));

      if (previousCount > chunks.length) {
        await Promise.all(
          Array.from({ length: previousCount - chunks.length }, (_, offset) =>
            store.deleteItemAsync(
              getSecureStoreChunkKey(key, chunks.length + offset),
            ),
          ),
        );
      }
    },

    async removeItem(key: string) {
      const countKey = getSecureStoreCountKey(key);
      const count = parseChunkCount(await store.getItemAsync(countKey));

      await Promise.all([
        store.deleteItemAsync(countKey),
        ...Array.from({ length: count }, (_, index) =>
          store.deleteItemAsync(getSecureStoreChunkKey(key, index)),
        ),
      ]);
    },
  };
}

export function isValidSecureStoreKey(key: string) {
  return key.length > 0 && SECURE_STORE_KEY_PATTERN.test(key);
}

export const secureStore = createChunkedSecureStore();
