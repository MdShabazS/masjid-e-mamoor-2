export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

export function ok<T>(data: T): ApiResult<T> {
  return { data, error: null };
}

export function fail<T = never>(
  code: string,
  message: string,
  details?: unknown,
): ApiResult<T> {
  return { data: null, error: { code, message, details } };
}
