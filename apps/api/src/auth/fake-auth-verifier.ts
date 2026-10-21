import type { AuthVerifier, VerifiedIdentity } from "./auth-verifier.js";

/** Deterministic verifier used in tests: token is `test:<uid>:<email>`. */
export class FakeAuthVerifier implements AuthVerifier {
  static tokenFor(uid: string, email: string): string {
    return `test:${uid}:${email}`;
  }

  async verify(idToken: string): Promise<VerifiedIdentity> {
    const [prefix, uid, email] = idToken.split(":");
    if (prefix !== "test" || !uid || !email) throw new Error("invalid token");
    return { uid, email };
  }
}
