import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app.js";
import { FakeAuthVerifier } from "./auth/fake-auth-verifier.js";
import { FirebaseAuthVerifier } from "./auth/firebase-auth-verifier.js";

const prisma = new PrismaClient();
const useFakeAuth = process.env.NODE_ENV !== "production" && !process.env.FIREBASE_PROJECT_ID;
const app = await buildApp({
  prisma,
  authVerifier: useFakeAuth
    ? new FakeAuthVerifier()
    : new FirebaseAuthVerifier(process.env.FIREBASE_PROJECT_ID || undefined),
  corsOrigins: process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()),
});

await app.listen({ port: Number(process.env.PORT ?? 3333), host: "0.0.0.0" });
