const IDENTITY_MESSAGES = {
  INVALID_CREDENTIALS: 'Username or password is incorrect.',
  RATE_LIMITED: 'Too many attempts. Try again in a few minutes.',
  ACCOUNT_INACTIVE: 'This account is inactive. Contact your administrator.',
  AUTH_REQUIRED: 'Your sign-in has expired. Sign in again.',
  FORBIDDEN: 'This account cannot perform that action.',
  VALIDATION_FAILED: 'Check the information you entered and try again.',
  OPERATION_CONFLICT: 'This request is no longer current. Sign in again.',
  SESSION_UNAVAILABLE: 'Could not save your sign-in. Try again.',
  SERVICE_UNAVAILABLE: 'Account service is unavailable. Try again later.',
  RECONCILIATION_REQUIRED: 'Account setup needs administrator review.',
};

function identityError(code) {
  return Object.assign(
    new Error(IDENTITY_MESSAGES[code] || IDENTITY_MESSAGES.SERVICE_UNAVAILABLE),
    {
      code,
    },
  );
}

async function post(path, body, fetchImpl = fetch, accessToken) {
  const response = await fetchImpl(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result?.data)
    throw identityError(result?.error?.code || 'SERVICE_UNAVAILABLE');
  return result.data;
}

export async function signInUsername({
  client,
  username,
  password,
  baseUrl = '',
  fetchImpl = fetch,
}) {
  if (!client?.auth?.setSession) throw new Error('client_required');
  const result = await post(`${baseUrl}/api/v1/session`, { username, password }, fetchImpl);
  const { error } = await client.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });
  if (error) throw identityError('SESSION_UNAVAILABLE');
  return { mustChangePassword: result.mustChangePassword };
}

export async function changeInitialPassword({
  client,
  newPassword,
  baseUrl = '',
  fetchImpl = fetch,
}) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) throw identityError('AUTH_REQUIRED');
  await post(
    `${baseUrl}/api/v1/session/change-password`,
    {
      refreshToken: data.session.refresh_token,
      newPassword,
    },
    fetchImpl,
    data.session.access_token,
  );
  // A server-side credential update may rotate the refresh token. Require a
  // fresh username login with the new password rather than reusing old state.
  await client.auth.signOut();
}
