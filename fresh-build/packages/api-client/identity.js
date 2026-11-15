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
  let response, result;
  try {
    response = await fetchImpl(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    result = await response.json();
  } catch {
    throw identityError('SERVICE_UNAVAILABLE');
  }
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
  const signedOut = await client.auth.signOut();
  if (signedOut?.error) await client.auth.signOut({ scope: 'local' });
}

async function accountCommand({ client, baseUrl = '', path, body, fetchImpl = fetch }) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.access_token) throw identityError('AUTH_REQUIRED');
  return post(`${baseUrl}/api/v1/users${path}`, body, fetchImpl, data.session.access_token);
}

/** Returns the one-time temporary password the new person must change at first sign-in. */
export function createAccount({ client, baseUrl = '', username, role, fetchImpl = fetch }) {
  return accountCommand({ client, baseUrl, fetchImpl, path: '', body: { username, role } });
}

export function resetAccountPassword({ client, baseUrl = '', targetId, fetchImpl = fetch }) {
  return accountCommand({ client, baseUrl, fetchImpl, path: `/${targetId}/reset`, body: {} });
}

export function setAccountStatus({
  client,
  baseUrl = '',
  targetId,
  role,
  active,
  fetchImpl = fetch,
}) {
  return accountCommand({
    client,
    baseUrl,
    fetchImpl,
    path: `/${targetId}/state`,
    body: { role, active },
  });
}

export const ROLE_LABELS = {
  system_admin: 'System Admin',
  president: 'President',
  vice_president: 'Vice President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  committee_member: 'Committee Member',
  member: 'Member',
  data_entry: 'Data Entry (masjid laptop)',
};

/** Roles a manager may assign: a System Admin any, a President only the roles they manage. */
export function assignableRoles(managerRole) {
  const all = Object.keys(ROLE_LABELS);
  if (managerRole === 'system_admin') return all;
  if (managerRole === 'president')
    return all.filter((role) => !['system_admin', 'president'].includes(role));
  return [];
}
