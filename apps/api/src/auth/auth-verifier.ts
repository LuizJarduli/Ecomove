export interface VerifiedIdentity {
  uid: string;
  email: string;
  name?: string;
}

export interface SessionCredential {
  sessionCookie: string;
  expiresInMs: number;
}

/** Boundary for Firebase Auth verification (ADR-0005). */
export interface AuthVerifier {
  /** Verifies a Firebase ID token or a session credential previously issued by `createSession`. */
  verify(token: string): Promise<VerifiedIdentity>;
  /** Exchanges a freshly issued ID token for a long-lived session credential (httpOnly cookie in the web portal). */
  createSession(idToken: string): Promise<SessionCredential>;
}

export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
