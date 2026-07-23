/**
 * errorUtils.ts — Shared API error-handling utilities
 *
 * Replaces the `err: any` antipattern across all CRUD pages.
 * Provides type-safe extraction of Axios/API error messages.
 */

interface ApiErrorShape {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

/**
 * Safely extract a human-readable message from an unknown error value.
 *
 * Priority:
 *   1. `error.response.data.message`  (API-level error message)
 *   2. `error.message`                (network / JS Error message)
 *   3. `fallback`                     (caller-provided default)
 *
 * @example
 *   } catch (err: unknown) {
 *     setError(getApiErrorMessage(err, "Unable to save. Please try again."));
 *   }
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const apiErr = err as ApiErrorShape;
    const apiMessage = apiErr.response?.data?.message;
    if (apiMessage && typeof apiMessage === "string") return apiMessage;
    const errMessage = apiErr.message;
    if (errMessage && typeof errMessage === "string") return errMessage;
  }
  return fallback;
}
