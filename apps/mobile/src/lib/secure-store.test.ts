import {
  createChunkedSecureStore,
  getSecureStoreChunkKey,
  getSecureStoreCountKey,
  isValidSecureStoreKey,
  SECURE_STORE_CHUNK_SIZE,
} from "./secure-store";

function createMemorySecureStore() {
  const values = new Map<string, string>();

  return {
    values,
    api: {
      getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      deleteItemAsync: jest.fn(async (key: string) => {
        values.delete(key);
      }),
    },
  };
}

describe("chunked SecureStore adapter", () => {
  const storageKey = "sb:project/auth-token";

  it("uses valid deterministic keys and reconstructs chunked values", async () => {
    const memoryStore = createMemorySecureStore();
    const adapter = createChunkedSecureStore(memoryStore.api);
    const value = `${"a".repeat(SECURE_STORE_CHUNK_SIZE)}second-chunk`;

    await adapter.setItem(storageKey, value);

    expect([...memoryStore.values.keys()].every(isValidSecureStoreKey)).toBe(
      true,
    );
    expect(memoryStore.values.get(getSecureStoreCountKey(storageKey))).toBe(
      "2",
    );
    expect(await adapter.getItem(storageKey)).toBe(value);
  });

  it("preserves an empty string value", async () => {
    const memoryStore = createMemorySecureStore();
    const adapter = createChunkedSecureStore(memoryStore.api);

    await adapter.setItem(storageKey, "");

    expect(await adapter.getItem(storageKey)).toBe("");
  });

  it("deletes excess chunks when a stored value becomes shorter", async () => {
    const memoryStore = createMemorySecureStore();
    const adapter = createChunkedSecureStore(memoryStore.api);

    await adapter.setItem(storageKey, "a".repeat(SECURE_STORE_CHUNK_SIZE * 3));
    await adapter.setItem(storageKey, "short");

    expect(memoryStore.values.has(getSecureStoreChunkKey(storageKey, 1))).toBe(
      false,
    );
    expect(memoryStore.values.has(getSecureStoreChunkKey(storageKey, 2))).toBe(
      false,
    );
    expect(await adapter.getItem(storageKey)).toBe("short");
  });

  it("rejects unreasonable chunk metadata safely", async () => {
    const memoryStore = createMemorySecureStore();
    const adapter = createChunkedSecureStore(memoryStore.api);

    memoryStore.values.set(
      getSecureStoreCountKey(storageKey),
      "999999999",
    );

    await expect(adapter.getItem(storageKey)).resolves.toBeNull();
  });

  it("returns null when an expected chunk is missing", async () => {
    const memoryStore = createMemorySecureStore();
    const adapter = createChunkedSecureStore(memoryStore.api);

    await adapter.setItem(
      storageKey,
      "a".repeat(SECURE_STORE_CHUNK_SIZE + 1),
    );

    memoryStore.values.delete(getSecureStoreChunkKey(storageKey, 1));

    await expect(adapter.getItem(storageKey)).resolves.toBeNull();
  });

  it("removes the count and every stored chunk", async () => {
    const memoryStore = createMemorySecureStore();
    const adapter = createChunkedSecureStore(memoryStore.api);

    await adapter.setItem(storageKey, "a".repeat(SECURE_STORE_CHUNK_SIZE + 1));
    await adapter.removeItem(storageKey);

    expect(memoryStore.values.size).toBe(0);
    expect(await adapter.getItem(storageKey)).toBeNull();
  });
});
