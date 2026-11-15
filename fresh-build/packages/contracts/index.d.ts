export type UUID = string;
export type Paise = string; // exact decimal text, checked against signed bigint
export type ApiResult<T> = { data: T; requestId: UUID; revision?: number };
export type ApiFailure = {
  error: { code: string; message: string; requestId: UUID; retryable: boolean };
};
export type OpeningInput = {
  accountId: UUID;
  amountPaise: Paise;
  evidenceReference: string;
  operationId: UUID;
};
export type TransferInput = {
  fromAccountId: UUID;
  toAccountId: UUID;
  amountPaise: Paise;
  evidenceReference: string;
  operationId: UUID;
};
export type VerificationInput = {
  operationId: UUID;
  expectedRevision: number;
  accountId: UUID;
  actualAmountPaise: Paise;
  evidenceReference: string;
};
export type DonorEnrollmentInput = {
  operationId: UUID;
  name: string;
  whatsapp: string;
  suggestedAmountPaise: Paise;
  referrerId?: UUID | null;
  consentMethod: 'in-person' | 'phone-call' | 'message';
  consentRecordedAt: string;
  evidenceReference: string;
};
export type MonthlyClaimInput = {
  operationId: UUID;
  donorId: UUID;
  periodDate: string;
  transactionReference: string;
};
export type AccountProjection = {
  accountId: UUID;
  accountName: string;
  accountKind: 'cash' | 'upi' | 'bank';
  active: boolean;
  balancePaise: Paise;
};
export type FinanceEvent = {
  sourceId: UUID;
  sourceType: 'account_opening' | 'monthly_contribution' | 'transfer';
  accountId: UUID;
  leg: 0 | 1 | 2;
  amountPaise: string;
  occurredAt: string;
};
export declare class ContractError extends Error {
  code: string;
}
export declare function uuid(value: unknown): UUID;
export declare function paise(value: unknown, opts?: { zero?: boolean }): Paise;
export declare function parseOpening(value: unknown): OpeningInput;
export declare function parseTransfer(value: unknown): TransferInput;
export declare function parseVerification(value: unknown): VerificationInput;
export declare function parseDonorEnrollment(value: unknown): DonorEnrollmentInput;
export declare function parseMonthlyClaim(value: unknown): MonthlyClaimInput;
export declare function apiError(code: string, requestId: UUID, retryable?: boolean): ApiFailure;
export declare function makeCursor(
  value: { createdAt: string; id: UUID; scope: string },
  secret: string,
): string;
export declare function readCursor(
  token: string,
  scope: string,
  secret: string,
): { createdAt: string; id: UUID };
export declare function pageLimit(value: unknown): number;
