import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const green = '#145b49';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function Button({ label, onPress, disabled = false, selected = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled, selected && styles.selected]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function webApiUrl() {
  const base = process.env.EXPO_PUBLIC_WEB_API_URL?.replace(/\/+$/, '');
  if (!base || !/^https?:\/\/[^/]+$/i.test(base))
    throw new Error('The web API connection is not configured.');
  return `${base}/api/management/payment-qr`;
}

function imageType(asset) {
  if (asset.mimeType === 'image/png' || asset.mimeType === 'image/jpeg') return asset.mimeType;
  if (asset.mimeType) throw new Error('Choose a PNG or JPEG QR image.');
  if (/\.png$/i.test(asset.fileName ?? '')) return 'image/png';
  if (/\.(jpe?g)$/i.test(asset.fileName ?? '')) return 'image/jpeg';
  throw new Error('Choose a PNG or JPEG QR image.');
}

function imageDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not display the current QR.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not display the current QR.'));
    reader.readAsDataURL(blob);
  });
}

export default function PaymentQrProfile({ client }) {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState('');
  const [asset, setAsset] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(null);
  const selectedAccount = useRef('');

  useEffect(() => {
    let active = true;
    client
      .rpc('list_finance_accounts')
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) setError(failure.message || 'Payment accounts unavailable.');
        else
          setAccounts(
            (data ?? []).filter((a) => a.active && ['upi', 'bank'].includes(a.account_kind)),
          );
      })
      .catch((cause) => {
        if (active) setError(cause.message || 'Payment accounts unavailable.');
      });
    return () => {
      active = false;
    };
  }, [client]);

  async function token() {
    const { data, error: failure } = await client.auth.getSession();
    if (failure || !data?.session?.access_token) throw new Error('Sign in again.');
    return data.session.access_token;
  }

  function chooseAccount(id) {
    selectedAccount.current = id;
    setSelected(id);
    setAsset(null);
    setConfirmed(false);
    setCurrent(null);
    setError('');
    setNotice('');
    operation.current = null;
  }

  async function pickImage() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1,
      });
      if (result.canceled) return;
      const picked = result.assets?.[0];
      if (!picked?.uri) throw new Error('No QR image was selected.');
      const type = imageType(picked);
      if (picked.fileSize && picked.fileSize > MAX_IMAGE_BYTES)
        throw new Error('Choose an image no larger than 5 MB.');
      setAsset({
        uri: picked.uri,
        name: picked.fileName || (type === 'image/png' ? 'payment-qr.png' : 'payment-qr.jpg'),
        type,
      });
      setConfirmed(false);
      operation.current = null;
    } catch (cause) {
      setError(cause.message || 'Could not select a QR image.');
    }
  }

  async function viewCurrent() {
    if (!selected || busy) return;
    const accountId = selected;
    setBusy(true);
    setError('');
    setCurrent(null);
    try {
      const response = await fetch(`${webApiUrl()}?accountId=${encodeURIComponent(accountId)}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!response.ok) {
        const result = await response.json();
        if (result?.error?.code === 'QR_NOT_FOUND') {
          setNotice('No active QR for this account.');
          return;
        }
        throw new Error(result?.error?.code || 'Could not load the current QR.');
      }
      const image = await imageDataUrl(await response.blob());
      if (selectedAccount.current !== accountId) return;
      setCurrent({ image, versionId: response.headers.get('X-QR-Version-ID') });
      setNotice('Showing the active QR for this account.');
    } catch (cause) {
      setError(cause.message || 'Could not load the current QR.');
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!selected || !asset || !confirmed || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const operationId = operation.current ?? Crypto.randomUUID();
    operation.current = operationId;
    try {
      const form = new FormData();
      form.append('accountId', selected);
      form.append('operationId', operationId);
      form.append('payeeConfirmed', 'true');
      const imageFile = new File(asset.uri);
      if (imageFile.size > MAX_IMAGE_BYTES) throw new Error('Choose an image no larger than 5 MB.');
      form.append('file', imageFile);
      const response = await fetch(webApiUrl(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.code || 'QR update failed.');
      setAsset(null);
      setConfirmed(false);
      setCurrent(null);
      operation.current = null;
      setNotice('New QR is active for future requests. Earlier requests keep their saved QR.');
    } catch (cause) {
      setError(cause.message || 'QR update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>My profile · Payment QR</Text>
      <Text style={styles.muted}>
        A replacement QR becomes current for future requests. Check its payee against the official
        masjid bank record before activating.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {accounts.length === 0 && <Text>No active bank or UPI account is configured.</Text>}
      {accounts.map((account) => (
        <Button
          key={account.account_id}
          label={`${account.account_name} (${account.account_kind})`}
          selected={selected === account.account_id}
          disabled={busy}
          onPress={() => chooseAccount(account.account_id)}
        />
      ))}
      {!!selected && (
        <>
          <Button label="View current QR" disabled={busy} onPress={viewCurrent} />
          {current && (
            <View>
              <Image
                source={{ uri: current.image }}
                style={styles.image}
                accessibilityLabel="Current payment QR"
              />
              <Text style={styles.muted}>Version: {current.versionId}</Text>
            </View>
          )}
          <Button label="Choose replacement QR image" disabled={busy} onPress={pickImage} />
          {asset && (
            <View>
              <Image
                source={{ uri: asset.uri }}
                style={styles.image}
                accessibilityLabel="New payment QR preview"
              />
              <Text style={styles.muted}>{asset.name}</Text>
              <View style={styles.confirmation}>
                <Switch
                  value={confirmed}
                  onValueChange={setConfirmed}
                  accessibilityLabel="Confirm QR payee"
                />
                <Text style={styles.confirmationText}>
                  I scanned this image and confirmed its payee matches this masjid account and the
                  official bank record.
                </Text>
              </View>
            </View>
          )}
          <Button
            label={busy ? 'Saving…' : 'Activate new QR'}
            disabled={!asset || !confirmed || busy}
            onPress={activate}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#d9e1d9',
  },
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: green, padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  selected: { backgroundColor: '#0d3d31' },
  disabled: { opacity: 0.55 },
  image: { width: 240, height: 240, resizeMode: 'contain', marginVertical: 8 },
  confirmation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmationText: { flex: 1, color: '#182e2a', lineHeight: 21 },
  error: { color: '#a32b28', backgroundColor: '#fff0ed', padding: 12, borderRadius: 8 },
  notice: { color: green, backgroundColor: '#e8f3ed', padding: 12, borderRadius: 8 },
});
