/** Keep a failed mutation's operation ID for an exact retry. Once the RPC succeeds,
 * a failed list refresh must not make the caller repeat the mutation.
 */
export async function runTaskCommand({ operations, key, name, args, rpc, refresh, createId }) {
  const operationId = operations.get(key) ?? createId();
  operations.set(key, operationId);
  try {
    await rpc(name, { ...args, p_operation_id: operationId });
  } catch (error) {
    return { saved: false, refreshed: false, error };
  }
  operations.delete(key);
  try {
    await refresh();
    return { saved: true, refreshed: true };
  } catch {
    return { saved: true, refreshed: false };
  }
}
