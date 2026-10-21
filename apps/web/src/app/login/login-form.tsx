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
      <label className="block text-sm font-medium text-[#111111]">
        E-mail Institucional
        <input
          name="email"
          type="email"
          placeholder="gestor@facens.br"
          required
          className="mt-1.5 w-full rounded-lg border border-[#E7E7E4] bg-[#F7F7F5] px-3.5 py-2.5 text-sm text-[#111111] transition-shadow outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
        />
      </label>
      <label className="block text-sm font-medium text-[#111111]">
        Senha
        <input
          name="password"
          type="password"
          required
          className="mt-1.5 w-full rounded-lg border border-[#E7E7E4] bg-[#F7F7F5] px-3.5 py-2.5 text-sm text-[#111111] transition-shadow outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg border border-[#BA1A1A]/30 bg-[#FFDAD6]/40 px-3 py-2 text-sm text-[#93000A]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[#111111] py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Verificando credenciais…" : "Entrar no Painel"}
      </button>
    </form>
  );
}
