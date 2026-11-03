import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const PortalApp = lazy(() => import("@/portal/App"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal Tesouraria EloPar" },
      { name: "description", content: "Portal corporativo da Tesouraria da Elo Participações: contas, indicadores, caixa, empréstimos e controles." },
      { property: "og:title", content: "Portal Tesouraria EloPar" },
      { property: "og:description", content: "Gestão de tesouraria da Elo Participações em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A192F] text-sm font-semibold text-slate-300">
      Iniciando Portal Tesouraria EloPar...
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <PortalApp />
      </Suspense>
    </ClientOnly>
  );
}
