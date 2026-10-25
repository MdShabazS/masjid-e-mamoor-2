import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import {
  verifyMetaSignature,
  verifyWebhookChallenge,
  extractWebhookEvents,
  isStop,
  toE164,
  retryDelaySeconds,
  makeTemplateRequest,
  sendTemplate,
} from './transport.js';

test('webhook requires HMAC over exact raw bytes and constant-time token comparison', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const header = 'sha256=' + createHmac('sha256', 'test-secret').update(body).digest('hex');
  assert.equal(verifyMetaSignature(body, header, 'test-secret'), true);
  assert.equal(
    verifyMetaSignature(Buffer.from(body.toString() + ' '), header, 'test-secret'),
    false,
  );
  assert.equal(verifyMetaSignature(body, 'sha256=' + '0'.repeat(64), 'test-secret'), false);
  assert.equal(verifyMetaSignature(body, header, ''), false);
  assert.equal(
    verifyWebhookChallenge(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'secret', 'hub.challenge': 'challenge' },
      'secret',
    ),
    'challenge',
  );
  assert.equal(
    verifyWebhookChallenge(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'challenge' },
      'secret',
    ),
    null,
  );
});

test('STOP is precise; normalize provider sender and ignore unsupported message types', () => {
  const events = extractWebhookEvents({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              messages: [
                { id: 'wamid.1', from: '919876543210', type: 'text', text: { body: ' STOP ' } },
                { id: 'wamid.2', from: '919876543210', type: 'image' },
              ],
              statuses: [{ id: 'wamid.3', status: 'delivered', timestamp: '12345' }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(events.length, 3);
  assert.equal(isStop(events[0].text), true);
  assert.equal(isStop('stopped'), false);
  assert.equal(toE164(events[0].from), '+919876543210');
  assert.throws(() => toE164('+919876543210'), /invalid_sender/);
  assert.equal(events[1].text, '');
  const onlyOwn = extractWebhookEvents(
    {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'other' },
                messages: [
                  {
                    id: 'wamid.1',
                    from: '919876543210',
                    type: 'text',
                    text: { body: 'STOP' },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    '1234567890',
  );
  assert.deepEqual(onlyOwn, []);
});

test('missing Business number or template blocks send; only accepted response records an ID', async () => {
  assert.throws(
    () => makeTemplateRequest({ templateName: 'monthly_request' }),
    /whatsapp_not_configured/,
  );
  const request = makeTemplateRequest({
    phoneNumberId: '1234567890',
    templateName: 'monthly_request',
    languageCode: 'en',
    to: '+919876543210',
    parameters: ['A', '₹500.00'],
    apiVersion: 'v23.0',
  });
  assert.equal(request.body.to, '919876543210');
  const fake = async () => ({
    ok: true,
    json: async () => ({ messages: [{ id: 'wamid.valid' }] }),
  });
  assert.equal(await sendTemplate(request, 'server-only-access-token', fake), 'wamid.valid');
  await assert.rejects(
    () =>
      sendTemplate(request, 'server-only-access-token', async () => ({ ok: false, status: 429 })),
    /provider_rate_limited/,
  );
  assert.deepEqual([1, 2, 3, 4, 5].map(retryDelaySeconds), [60, 120, 240, 480, 960]);
});
