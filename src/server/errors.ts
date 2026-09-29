export type FieldErrors = Record<string, string[]>;

/**
 * An expected, client-facing error. Anything thrown that is NOT an AppError
 * (or one of the library errors mapped in http.ts) becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST") => new AppError(400, code, message);

export const unauthorized = (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message);

// Also used for resources owned by another user, so their existence is never revealed.
export const notFound = (resource: string) => new AppError(404, "NOT_FOUND", `${resource} not found`);

export const conflict = (code: string, message: string, fields?: FieldErrors) =>
  new AppError(409, code, message, fields);

export const validationError = (fields: FieldErrors, message = "Validation failed") =>
  new AppError(422, "VALIDATION_ERROR", message, fields);

export const tooManyRequests = (message: string) => new AppError(429, "RATE_LIMITED", message);
