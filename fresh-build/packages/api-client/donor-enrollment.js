import { parseINRToPaise } from './index.js';

export async function enrollConsentedDonor({ client, baseUrl = '', input, fetchImpl = fetch }) {
  parseINRToPaise(input.suggestedAmountINR);
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error('AUTH_REQUIRED');
  const response = await fetchImpl(`${baseUrl}/api/management/enroll-donor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.code || 'ENROLLMENT_REJECTED');
  return result.data.donorId;
}
