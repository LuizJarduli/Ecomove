"use client";

/** Client edge case: unexpected failures (API down, 5xx) with a retry. */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="max-w-md space-y-4 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-8">
        <span className="label-caps rounded bg-[#FFDAD6] px-2.5 py-1 text-[#93000A]">Falha de Comunicação</span>
        <h1 className="text-xl font-semibold">Não foi possível carregar o painel</h1>
        <p className="text-sm text-[#6B6B6B]">O servidor geoespacial está indisponível no momento. Tente novamente.</p>
        <button
          onClick={reset}
          className="rounded-full bg-[#111111] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
