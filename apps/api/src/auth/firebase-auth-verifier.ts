import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import {
  SESSION_DURATION_MS,
  type AuthVerifier,
  type SessionCredential,
  type VerifiedIdentity,
} from "./auth-verifier.js";

export class FirebaseAuthVerifier implements AuthVerifier {
  constructor(projectId?: string) {
    if (getApps().length === 0) {
      initializeApp(projectId ? { projectId } : undefined);
    }
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch {
      decoded = await getAuth().verifySessionCookie(token);
    }
    if (!decoded.email || decoded.email_verified === false) {
      throw new Error("email not verified");
    }
    return { uid: decoded.uid, email: decoded.email, name: decoded.name };
  }

  async createSession(idToken: string): Promise<SessionCredential> {
    await this.verify(idToken);
    const sessionCookie = await getAuth().createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
    return { sessionCookie, expiresInMs: SESSION_DURATION_MS };
  }
}
