import {
  SESSION_DURATION_MS,
  type AuthVerifier,
  type SessionCredential,
  type VerifiedIdentity,
} from "./auth-verifier.js";

/** Deterministic verifier used in tests: ID tokens are `test:<uid>:<email>`, sessions `session:<uid>:<email>`. */
export class FakeAuthVerifier implements AuthVerifier {
  static tokenFor(uid: string, email: string): string {
    return `test:${uid}:${email}`;
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    const [prefix, uid, email] = token.split(":");
    if ((prefix !== "test" && prefix !== "session") || !uid || !email) throw new Error("invalid token");
    return { uid, email };
  }

  async createSession(idToken: string): Promise<SessionCredential> {
    const [prefix, uid, email] = idToken.split(":");
    if (prefix !== "test" || !uid || !email) throw new Error("invalid token");
    return { sessionCookie: `session:${uid}:${email}`, expiresInMs: SESSION_DURATION_MS };
  }
}
