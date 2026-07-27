/**
 * errorUtils.ts — Shared API error-handling utilities
 *
 * Replaces the `err: any` antipattern across all CRUD pages.
 * Provides type-safe extraction of Axios/API error messages.
 */

interface ApiErrorShape {
  _friendlyMessage?: string;
  response?: {
    data?: {
      message?: string;
      errors?: Array<{ field?: string; message?: string }>;
    };
  };
  message?: string;
}

/**
 * Safely extract a human-readable message from an unknown error value.
 *
 * Priority:
 *   1. `error._friendlyMessage`        (enriched by axios interceptor — offline/timeout/5xx/403)
 *   2. first validation.error.message  (validation error list from server)
 *   3. `error.response.data.message`   (API-level error message)
 *   4. `error.message`                 (network / JS Error message)
 *   5. `fallback`                      (caller-provided default)
 *
 * @example
 *   } catch (err: unknown) {
 *     setError(getApiErrorMessage(err, "Unable to save. Please try again."));
 *   }
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const apiErr = err as ApiErrorShape;
    if (apiErr._friendlyMessage && typeof apiErr._friendlyMessage === "string") return apiErr._friendlyMessage;
    const validationErrors = apiErr.response?.data?.errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      const firstMsg = validationErrors[0]?.message;
      if (firstMsg && typeof firstMsg === "string") return firstMsg;
    }
    const apiMessage = apiErr.response?.data?.message;
    if (apiMessage && typeof apiMessage === "string") return apiMessage;
    const errMessage = apiErr.message;
    if (errMessage && typeof errMessage === "string") return errMessage;
  }
  return fallback;
}
