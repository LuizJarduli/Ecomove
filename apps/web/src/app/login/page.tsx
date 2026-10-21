import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session.status === "manager") redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <div>
          <h1 className="text-2xl font-semibold">EcoMove</h1>
          <p className="text-sm text-zinc-500">Portal do Gestor de Mobilidade</p>
        </div>
        {session.status === "forbidden" && (
          <p role="alert" className="text-sm text-red-600">
            A conta {session.email} não possui perfil de Gestor de Mobilidade.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
