export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DATABASE_ERROR';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly safeDetails: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
