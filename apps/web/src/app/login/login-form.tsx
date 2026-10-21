"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useActionState } from "react";
import { startSession } from "@/actions/auth";
import { firebaseAuth } from "@/lib/firebase";

/** Client component only for what needs the browser: the Firebase sign-in handshake and pending state. */
export function LoginForm() {
  const [error, submit, pending] = useActionState(async (_previous: string | null, formData: FormData) => {
    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth(),
        String(formData.get("email")),
        String(formData.get("password")),
      );
      const result = await startSession(await credential.user.getIdToken());
      return result?.error ?? null;
    } catch {
      return "E-mail ou senha inválidos.";
    }
  }, null);

  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        E-mail
        <input name="email" type="email" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-green-600 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
