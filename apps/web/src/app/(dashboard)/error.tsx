"use client";

/** Client edge case: unexpected failures (API down, 5xx) with a retry. */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar o painel</h1>
      <p className="text-zinc-600">O servidor está indisponível no momento. Tente novamente.</p>
      <button onClick={reset} className="rounded-md bg-zinc-900 px-4 py-2 text-white">
        Tentar novamente
      </button>
    </main>
  );
}
