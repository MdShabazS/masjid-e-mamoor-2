# Live payment details handoff — pending

**Prepared:** 24 October 2026 (India time). **Status:** official bank/UPI details and QR are not yet available, per the project owner. This document records the handoff and test steps; it contains no account identifier or payment destination.

**Proposed source contact:** The owner said to ask Treasurer Janab Samiullah A to obtain the official details. This assigns a request, not confirmation that he has accepted it or supplied a record. The message has not been sent; no verified contact channel was provided.

## Message to send to the Treasurer

> Assalamu alaikum Janab Samiullah A. For the Masjid E Mamoor 2 donation system, could you obtain the masjid's official bank-verified payee name, account or UPI destination, and payment QR from the bank or approved provider? Please also provide the source record and the opening balance with its effective date through the masjid's approved private channel. We need you and a second Board-authorized operator to independently verify the payee, decoded QR and opening balance before any public real-money launch. Please do not send account details in a public group or add them to the code repository.

## Obtain from the masjid

- An authorized trustee obtains a bank-issued statement, letter, portal record or other official source showing the masjid's legal payee name and the account or UPI destination intended for donations.
- The masjid supplies the payment QR through its bank or approved payment provider. Retain the source and version privately. Do not use a generated or synthetic QR for real donations.
- The Treasurer and a second Board-authorized operator independently compare the official source, configured destination and decoded QR payload. Record each reviewer's name, date and result in the masjid's approved private records.
- Confirm the opening balance and effective date from the bank statement, with independent reconciliation and sign-off. Record the official public contact separately.

## Acceptance before receiving real money

- [ ] Source record and ownership verified; both reviewers confirm the beneficiary name and payment destination match.
- [ ] QR decoded from the exact image to be published, and its payee/destination match the approved source. Record its digest and version without placing secret account details in this repository.
- [ ] Separate staging and production configuration reviewed; public page and Android build show the approved payee and QR only after activation.
- [ ] A low-value real payment reaches the masjid's bank/UPI statement and is matched once to the app receipt and ledger; a documented correction/reversal path is checked.
- [ ] The masjid's operators sign the launch reconciliation and retain the evidence privately.

Until the official details and these checks exist, keep real-money payment routes and public QR publication disabled. The synthetic QR checks in earlier engineering tests demonstrate functionality only.
