import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session.status === "manager") redirect("/painel");

  return (
    <main className="relative flex min-h-screen flex-1 flex-col justify-between overflow-hidden bg-[#F7F7F5] p-6 text-[#111111]">
      {/* Subtle atmospheric orbs */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="absolute -mt-40 -ml-60 h-[320px] w-[320px] rounded-full bg-gradient-to-tr from-emerald-300/35 to-teal-200/35 blur-3xl" />
        <div className="absolute mt-40 ml-60 h-[340px] w-[340px] rounded-full bg-gradient-to-tr from-indigo-300/30 to-sky-200/30 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>EcoMove</span>
        </Link>
        <Link href="/" className="text-sm text-[#6B6B6B] transition-colors hover:text-[#111111]">
          ← Voltar para a apresentação
        </Link>
      </header>

      <div className="relative z-10 mx-auto my-12 w-full max-w-md rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB]/95 p-8 backdrop-blur-md">
        <div className="mb-6 space-y-2 border-b border-[#E7E7E4] pb-5">
          <span className="label-caps rounded bg-[#F3F2EF] px-2.5 py-1 text-[#111111]">
            Acesso Restrito · MobilityManager
          </span>
          <h1 className="pt-1 text-2xl font-semibold tracking-tight">Portal do Gestor de Mobilidade</h1>
          <p className="text-sm text-[#6B6B6B]">
            Entre com sua conta institucional para gerenciar a <code className="font-mono text-xs">CampusZone</code>,
            validar ocorrências e acompanhar os indicadores do campus.
          </p>
        </div>

        {session.status === "forbidden" && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-[#BA1A1A]/30 bg-[#FFDAD6]/50 px-4 py-3 text-sm text-[#93000A]"
          >
            A conta <strong>{session.email}</strong> não possui perfil de Gestor de Mobilidade.
          </p>
        )}

        <LoginForm />
      </div>

      <footer className="relative z-10 mx-auto w-full max-w-[1280px] text-center font-mono text-xs text-[#6B6B6B]">
        Centro Universitário Facens · UPX IV ·Autenticação Firebase Spark Plan
      </footer>
    </main>
  );
}
