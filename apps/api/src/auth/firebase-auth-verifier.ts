import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AuthVerifier, VerifiedIdentity } from "./auth-verifier.js";

export class FirebaseAuthVerifier implements AuthVerifier {
  constructor(projectId?: string) {
    if (getApps().length === 0) {
      initializeApp(projectId ? { projectId } : undefined);
    }
  }

  async verify(idToken: string): Promise<VerifiedIdentity> {
    const decoded = await getAuth().verifyIdToken(idToken);
    if (!decoded.email || decoded.email_verified === false) {
      throw new Error("email not verified");
    }
    return { uid: decoded.uid, email: decoded.email, name: decoded.name };
  }
}

