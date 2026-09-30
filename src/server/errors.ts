// Errors the services throw on purpose. http.ts turns each one into a JSON error response.

/** Messages per input field, e.g. { "items.1.quantity": ["Quantity must be at least 1"] }. */
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

/** Builds a 400 error, e.g. for a request body that is not valid JSON. */
export const badRequest = (message: string, code = "BAD_REQUEST") => new AppError(400, code, message);

/** Builds a 401 error: no valid session. */
export const unauthorized = (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message);

// Also used for resources owned by another user, so their existence is never revealed.
export const notFound = (resource: string) => new AppError(404, "NOT_FOUND", `${resource} not found`);

/** Builds a 409 error: the request is valid but clashes with the current state (stock, status, in use). */
export const conflict = (code: string, message: string, fields?: FieldErrors) =>
  new AppError(409, code, message, fields);

/** Builds a 422 VALIDATION_ERROR with messages per field. */
export const validationError = (fields: FieldErrors, message = "Validation failed") =>
  new AppError(422, "VALIDATION_ERROR", message, fields);
