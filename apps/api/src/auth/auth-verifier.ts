export interface VerifiedIdentity {
  uid: string;
  email: string;
  name?: string;
}

/** Boundary for Firebase Auth ID token verification (ADR-0005). */
export interface AuthVerifier {
  verify(idToken: string): Promise<VerifiedIdentity>;
}
