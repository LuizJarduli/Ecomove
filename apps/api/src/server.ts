import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app.js";
import { FirebaseAuthVerifier } from "./auth/firebase-auth-verifier.js";

const prisma = new PrismaClient();
const app = await buildApp({
  prisma,
  authVerifier: new FirebaseAuthVerifier(process.env.FIREBASE_PROJECT_ID || undefined),
});

await app.listen({ port: Number(process.env.PORT ?? 3333), host: "0.0.0.0" });
