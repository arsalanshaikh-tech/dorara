import type { LoginValues } from "@/lib/validators/auth";
import { ApiClientError, apiRequest } from "@/lib/api/client";

/**
 * Auth service — real calls to the backend's existing auth system (no second auth system):
 *   POST   /api/v1/auth/register | login | refresh | logout | verify-email | resend-verification
 *   POST   /api/v1/auth/forgot-password | reset-password | change-password
 *   GET    /api/v1/users/me          PATCH /api/v1/users/me          DELETE /api/v1/users/me
 *
 * Sessions are httpOnly cookies set by the backend. Requests go through the Vercel rewrite
 * (`/api/v1/*`), so the cookies are first-party; the browser never sees a token (see lib/api/client.ts).
 * Every failure is thrown as `ApiError { code, message }` so the existing forms keep working.
 */

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  location?: string;
  bio?: string;
};

export type ApiError = {
  code: string;
  message: string;
};

/** Maps backend error codes to friendly, user-facing messages. */
export function messageForCode(code: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "The email or password you entered is incorrect.";
    case "EMAIL_TAKEN":
      return "An account with this email already exists.";
    case "INVALID_TOKEN":
      return "This link is invalid or has expired. Please request a new one.";
    case "WRONG_PASSWORD":
      return "Your current password is incorrect.";
    case "ACCOUNT_LOCKED":
      return "Your account is temporarily locked. Please try again later.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a moment and try again.";
    case "UNAUTHENTICATED":
      return "Your session has expired. Please sign in again.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email address to continue.";
    case "ACCOUNT_SUSPENDED":
      return "This account is not available. Please contact support.";
    case "NETWORK":
      return "We couldn’t reach the server. Check your connection and try again.";
    case "TIMEOUT":
      return "The server took too long to respond. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Run an API call and convert any failure into the `ApiError` shape the forms expect. */
async function call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn()).data;
  } catch (err) {
    if (err instanceof ApiClientError) {
      const apiError: ApiError = { code: err.code, message: err.message };
      throw apiError;
    }
    throw { code: "NETWORK", message: "Request failed" } satisfies ApiError;
  }
}

type UserEnvelope = { user: AuthUser };

/** POST /auth/login — sets the session cookies. */
export async function login(
  payload: Pick<LoginValues, "email" | "password"> & { remember?: boolean },
): Promise<{ ok: true }> {
  await call(() =>
    apiRequest("POST", "/auth/login", {
      body: { email: payload.email.trim(), password: payload.password, remember: payload.remember },
      noRefresh: true,
    }),
  );
  return { ok: true };
}

/** POST /auth/register — creates the account (and signs in; verification email is optional). */
export async function register(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  await call(() =>
    apiRequest("POST", "/auth/register", {
      body: { name: payload.name.trim(), email: payload.email.trim(), password: payload.password },
      noRefresh: true,
    }),
  );
  return { ok: true };
}

/** POST /auth/logout — revokes the refresh session and clears the cookies. */
export async function logout(): Promise<{ ok: true }> {
  try {
    await apiRequest("POST", "/auth/logout", { body: {}, noRefresh: true });
  } catch {
    /* the local sign-out must succeed even if the server is unreachable */
  }
  return { ok: true };
}

/** POST /auth/forgot-password — always resolves (the UI never reveals whether an email exists). */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  try {
    await apiRequest("POST", "/auth/forgot-password", { body: { email: email.trim() }, noRefresh: true });
  } catch (err) {
    if (err instanceof ApiClientError && (err.code === "RATE_LIMITED" || err.code === "NETWORK" || err.code === "TIMEOUT")) {
      throw { code: err.code, message: err.message } satisfies ApiError;
    }
  }
  return { ok: true };
}

/** POST /auth/reset-password */
export async function resetPassword(payload: {
  token?: string;
  password: string;
}): Promise<{ ok: true }> {
  await call(() =>
    apiRequest("POST", "/auth/reset-password", {
      body: { token: payload.token ?? "", password: payload.password },
      noRefresh: true,
    }),
  );
  return { ok: true };
}

/** POST /auth/verify-email */
export async function verifyEmail(token?: string): Promise<{ ok: true }> {
  await call(() => apiRequest("POST", "/auth/verify-email", { body: { token: token ?? "" }, noRefresh: true }));
  return { ok: true };
}

/** POST /auth/resend-verification (signed-in users) */
export async function resendVerification(): Promise<{ ok: true }> {
  await call(() => apiRequest("POST", "/auth/resend-verification", { body: {} }));
  return { ok: true };
}

/** PATCH /users/me — name, location and bio (the email address cannot be changed here). */
export async function updateProfile(
  payload: Partial<Pick<AuthUser, "name" | "email" | "location" | "bio">>,
): Promise<{ ok: true }> {
  const { name, location, bio } = payload;
  await call(() => apiRequest("PATCH", "/users/me", { body: { name, location, bio } }));
  return { ok: true };
}

/** POST /auth/change-password */
export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  await call(() => apiRequest("POST", "/auth/change-password", { body: payload }));
  return { ok: true };
}

/** DELETE /users/me — the backend requires the account password for confirmation. */
export async function deleteAccount(password?: string): Promise<{ ok: true }> {
  await call(() => apiRequest("DELETE", "/users/me", { body: { password: password ?? "" } }));
  return { ok: true };
}

/** GET /users/me — restores the session from the httpOnly cookie. Rejects with UNAUTHENTICATED when signed out. */
export async function getMe(): Promise<AuthUser> {
  const data = await call(() => apiRequest<UserEnvelope>("GET", "/users/me"));
  return data.user;
}
