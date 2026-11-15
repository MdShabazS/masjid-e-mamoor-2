const QR_PATH = /^payment-qr\/[0-9a-f-]{36}\.(?:png|jpg|jpeg)$/;

export async function removeStaleQrObject(service, assetPath) {
  if (!QR_PATH.test(assetPath)) throw new Error('invalid_qr_cleanup_path');
  const { data: claimed, error: claimError } = await service.rpc('claim_stale_qr_object', {
    p_asset_path: assetPath,
  });
  if (claimError) throw new Error('qr_cleanup_claim_failed');
  if (claimed !== true) return { state: 'skipped', assetPath };

  const { error: removeError } = await service.storage.from('qr-private').remove([assetPath]);
  // A timeout can arrive after Storage committed the removal. The database
  // finish RPC succeeds only when the object is actually absent.
  if (removeError) {
    const { data: finished, error: finishError } = await service.rpc('finish_qr_object_cleanup', {
      p_asset_path: assetPath,
    });
    if (finishError || finished !== true) throw new Error('qr_cleanup_storage_remove_failed');
    return { state: 'removed', assetPath };
  }

  const { data: finished, error: finishError } = await service.rpc('finish_qr_object_cleanup', {
    p_asset_path: assetPath,
  });
  if (finishError || finished !== true) throw new Error('qr_cleanup_finish_failed');
  return { state: 'removed', assetPath };
}
