"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CampusZoneMapLoader } from "@/components/campus-zone-map-loader";
import { FACENS_PREVIEW_ZONE } from "@/lib/facens-preview-zone";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type ShowcaseTab = "mobilidade" | "zeladoria" | "bi";

const TRANSPORT_MODES = [
  {
    code: "WALK",
    label: "Caminhada",
    points: "10 EcoPoints / km",
    co2: "140 g CO₂ / km evitados",
    speed: "Até 8 km/h méd. (máx. 12 km/h)",
    badge: "Ativo · Zero Emissão",
  },
  {
    code: "BICYCLE",
    label: "Bicicleta",
    points: "8 EcoPoints / km",
    co2: "140 g CO₂ / km evitados",
    speed: "Até 28 km/h méd. (máx. 38 km/h)",
    badge: "Ciclovia & Campus",
  },
  {
    code: "CARPOOL",
    label: "Carona Solidária",
    points: "5 EcoPoints / km",
    co2: "70 g CO₂ / km por passageiro",
    speed: "Pareamento via QR / Código 4 dígitos",
    badge: "CarpoolSession Verificada",
  },
  {
    code: "PUBLIC_TRANSIT",
    label: "Transporte Público",
    points: "4 EcoPoints / km",
    co2: "100 g CO₂ / km evitados",
    speed: "Corredores urbanos & CampusZone",
    badge: "Coletivo Urbano",
  },
] as const;

const HAZARD_CATEGORIES = [
  {
    code: "SIDEWALK_DAMAGE",
    title: "Calçada Danificada",
    desc: "Buracos, desníveis ou bloqueios estruturais no acesso pedonal ao campus.",
    endorsements: 18,
    statusLabel: "Aprovada · +25 EcoPoints",
  },
  {
    code: "BIKE_LANE_OBSTRUCTION",
    title: "Ciclovia Obstruída",
    desc: "Obstáculos, entulho ou sinalização apagada nos corredores cicloviários.",
    endorsements: 11,
    statusLabel: "Em Análise · 30m Dedup",
  },
  {
    code: "POOR_LIGHTING",
    title: "Iluminação Precária",
    desc: "Trechos escuros no entorno universitário durante o turno noturno.",
    endorsements: 24,
    statusLabel: "Prioridade Alta · BI",
  },
  {
    code: "BUS_STOP_ISSUE",
    title: "Ponto de Ônibus Degradado",
    desc: "Falta de cobertura, acessibilidade comprometida ou iluminação ausente.",
    endorsements: 9,
    statusLabel: "Resolvida pelo Gestor",
  },
] as const;

const STORY_CHAPTERS = [
  {
    chapter: "ATO I · COMUNIDADE ACADÊMICA",
    tag: "APLICATIVO MOBILE FLUTTER · COMUNIDADE",
    title: "Rastreamento GPS resiliente, Carpool QR e Carteira EcoPoints.",
    subtitle:
      "Beatriz registra seus deslocamentos até a FACENS mesmo em áreas de sombra de sinal graças à fila local SQLite, confirma caronas via QR Code e acumula até 100 EcoPoints por dia.",
    bullets: [
      "Validação espacial ST_Intersects contra o polígono oficial da CampusZone",
      "Pareamento de CarpoolSession por código de 4 dígitos ou QR Code",
      "Nudges personalizados de sustentabilidade via CommuterAiService",
    ],
    image: "/stitch/mobile-commuter.png",
    aspect: "mobile" as const,
  },
  {
    chapter: "ATO II · ZELADORIA URBANA & ECONOMIA",
    tag: "DEDUPLICAÇÃO ESPACIAL 30M · LEDGER IMUTÁVEL",
    title: "Ocorrências georreferenciadas sem duplicatas e estorno automático.",
    subtitle:
      "Ao detectar um relato ativo da mesma categoria em até 30 metros (ST_DWithin), o EcoMove sugere um endosso (+1 prioridade) em vez de duplicar pinos, creditando +25 EcoPoints quando aprovado pelo gestor.",
    bullets: [
      "Fotos comprimidas no cliente para WebP (< 300 KB) no plano Firebase Spark",
      "Livro-razão imutável (PointTransaction) para auditoria integral de saldos",
      "Vouchers de parceiros expiram em 7 dias com estorno automático de estoque e pontos",
    ],
    image: "/stitch/zeladoria-recompensas.png",
    aspect: "desktop" as const,
  },
  {
    chapter: "ATO III · BUSINESS INTELLIGENCE & IA",
    tag: "PORTAL DO GESTOR · POSTGIS + INSIGHTENGINE",
    title: "Decisões de infraestrutura guiadas por mapas de calor e IA.",
    subtitle:
      "Ricardo visualiza corredores críticos, divisão modal, emissões de CO₂ evitadas e aciona o InsightEngine (Gemini em nuvem ou Ollama local) para justificar investimentos viários no campus.",
    bullets: [
      "Mapas de calor PostGIS correlacionando fluxo de ciclistas/pedestres e ocorrências",
      "Filtro institucional automático para e-mails verificados @facens.br",
      "Facade de IA plugável (ADR-0004) alternando entre Gemini API e modelos locais",
    ],
    image: "/stitch/bi-dashboard.png",
    aspect: "desktop" as const,
  },
] as const;

const TEAM_MEMBERS = [
  { name: "Gabriel Ribeiro Latri", ra: "RA 251373", role: "Backend Fastify & PostGIS Geoespacial" },
  { name: "Giovanna Antunes de Campos", ra: "RA 250904", role: "Proposta Científica, Documentação & ODS" },
  { name: "Leonardo Hipólito Trevisani", ra: "RA 252186", role: "Pesquisa de Público-Alvo, Validação & Pitch" },
  { name: "Lucas Henrique Gomes", ra: "RA 251740", role: "Portal Web do Gestor & Sistema de Recompensas" },
  { name: "Luiz Miguel Jarduli Leite", ra: "RA 252520", role: "Aplicativo Mobile Flutter & Arquitetura" },
] as const;

export function LandingShowcase({ isAuthenticatedManager }: { isAuthenticatedManager: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroPinRef = useRef<HTMLDivElement>(null);
  const storyPinRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("mobilidade");

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
    };
  }, []);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      // Floating atmospheric orbs
      gsap.to("[data-orb-float]", {
        y: -28,
        x: 18,
        duration: 5.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.8,
      });

      const mm = gsap.matchMedia();

      mm.add("(min-width: 1024px)", () => {
        // 1. Pinned Hero Portal Scrub ("Only in FACENS" clip-path & scale zoom reveal)
        if (heroPinRef.current) {
          const heroTl = gsap.timeline({
            scrollTrigger: {
              trigger: heroPinRef.current,
              start: "top top",
              end: "+=135%",
              pin: true,
              scrub: 1,
            },
          });

          heroTl
            .to(
              "[data-hero-headline]",
              {
                scale: 0.86,
                opacity: 0,
                y: -60,
                ease: "power2.inOut",
              },
              0,
            )
            .fromTo(
              "[data-hero-portal]",
              {
                clipPath: "inset(22% 14% 22% 14% round 36px)",
                scale: 0.9,
              },
              {
                clipPath: "inset(0% 0% 0% 0% round 28px)",
                scale: 1,
                ease: "power2.inOut",
              },
              0,
            )
            .fromTo(
              "[data-hero-portal-caption]",
              { y: 36, opacity: 0 },
              { y: 0, opacity: 1, ease: "power2.out" },
              0.35,
            );
        }

        // 2. Pinned 3-Act Storyteller Deck (Scrubbed chapter crossfade & card scale)
        if (storyPinRef.current) {
          const storyTl = gsap.timeline({
            scrollTrigger: {
              trigger: storyPinRef.current,
              start: "top top",
              end: "+=260%",
              pin: true,
              scrub: 1,
            },
          });

          // Progress bar fill
          storyTl.fromTo(
            "[data-story-progress]",
            { scaleY: 0 },
            { scaleY: 1, ease: "none", duration: 2 },
            0,
          );

          // Transition Act 0 -> Act 1
          storyTl
            .to("[data-story-text='0']", { y: -40, opacity: 0, duration: 0.45, ease: "power2.inOut" }, 0.55)
            .to("[data-story-card='0']", { scale: 0.9, opacity: 0, duration: 0.45, ease: "power2.inOut" }, 0.55)
            .fromTo(
              "[data-story-text='1']",
              { y: 40, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" },
              0.75,
            )
            .fromTo(
              "[data-story-card='1']",
              { y: 60, scale: 0.94, opacity: 0 },
              { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: "power2.out" },
              0.75,
            );

          // Transition Act 1 -> Act 2
          storyTl
            .to("[data-story-text='1']", { y: -40, opacity: 0, duration: 0.45, ease: "power2.inOut" }, 1.35)
            .to("[data-story-card='1']", { scale: 0.9, opacity: 0, duration: 0.45, ease: "power2.inOut" }, 1.35)
            .fromTo(
              "[data-story-text='2']",
              { y: 40, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" },
              1.55,
            )
            .fromTo(
              "[data-story-card='2']",
              { y: 60, scale: 0.94, opacity: 0 },
              { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: "power2.out" },
              1.55,
            );
        }
      });

      // Standard staggered section reveals
      const sections = gsap.utils.toArray<HTMLElement>("[data-scroll-section]");
      sections.forEach((section) => {
        const items = section.querySelectorAll("[data-scroll-item]");
        gsap.fromTo(
          items.length > 0 ? items : section,
          { y: 44, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 82%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="min-h-screen bg-[#F7F7F5] text-[#111111] selection:bg-emerald-500/20">
      {/* TOP GLASS NAVIGATION (Auralis Visual Scaffolding) */}
      <header className="fixed top-0 z-50 w-full border-b border-[#E7E7E4] bg-[#F7F7F5]/80 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>EcoMove</span>
              <span className="label-caps rounded bg-[#E5E2E1] px-2 py-0.5 text-[10px] text-[#111111]">
                UPX IV · FACENS
              </span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-medium text-[#6B6B6B] lg:flex">
              <a href="#galeria" className="transition-colors hover:text-[#111111]">
                Narrativa &amp; Telas
              </a>
              <a href="#plataforma" className="transition-colors hover:text-[#111111]">
                Mapa PostGIS
              </a>
              <a href="#mobilidade" className="transition-colors hover:text-[#111111]">
                Modais
              </a>
              <a href="#zeladoria" className="transition-colors hover:text-[#111111]">
                Zeladoria 30m
              </a>
              <a href="#economia" className="transition-colors hover:text-[#111111]">
                EcoPoints
              </a>
              <a href="#equipe" className="transition-colors hover:text-[#111111]">
                Equipe &amp; ODS
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={isAuthenticatedManager ? "/painel" : "/login"}
              className="rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[0.98] active:opacity-85"
            >
              {isAuthenticatedManager ? "Abrir Painel do Gestor" : "Portal do Gestor"}
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-[140px]">
        {/* PINNED CINEMATIC HERO SECTION ("ONLY IN FACENS" GSAP SCRUBBED MASK REVEAL) */}
        <section
          ref={heroPinRef}
          className="relative mx-auto flex min-h-screen max-w-[1360px] flex-col justify-center overflow-hidden px-6 pt-[96px] pb-12 md:px-8"
        >
          {/* Foreground Typographic Lockup */}
          <div data-hero-headline className="relative z-20 mx-auto max-w-4xl text-center">
            <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
              <span className="label-caps rounded-full border border-[#E7E7E4] bg-[#FCFCFB] px-3.5 py-1.5 text-[#111111]">
                Centro Universitário Facens · Sorocaba/SP
              </span>
              <span className="label-caps rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-900">
                ODS 9 · ODS 11 · ODS 13
              </span>
            </div>

            <h1 className="text-[44px] leading-[0.95] font-semibold tracking-[-0.04em] text-[#111111] sm:text-[68px] lg:text-[84px]">
              Cada trajeto conta. Mobilidade urbana com precisão geoespacial.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-[1.6] text-[#6B6B6B]">
              Role para expandir o ecossistema <strong className="font-medium text-[#111111]">EcoMove</strong>:
              aplicativo móvel em Flutter para deslocamentos sustentáveis e zeladoria cidadã integrado ao Portal do
              Gestor com PostGIS, Business Intelligence e IA.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isAuthenticatedManager ? "/painel" : "/login"}
                className="rounded-full bg-[#111111] px-7 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {isAuthenticatedManager ? "Acessar Painel do Gestor" : "Entrar no Portal do Gestor"}
              </Link>
              <a
                href="#plataforma"
                className="rounded-full border border-[#C4C7C7] bg-[#FCFCFB]/80 px-7 py-3 text-sm font-medium text-[#111111] backdrop-blur-xs transition-colors hover:bg-[#E5E2E1]/60"
              >
                Testar Mapa PostGIS Ao Vivo
              </a>
            </div>
          </div>

          {/* Scrub-Expanded Architectural Portal Window */}
          <div
            data-hero-portal
            className="relative z-10 mt-8 overflow-hidden rounded-[28px] border border-[#E7E7E4] bg-[#1C1B1B] p-4 shadow-2xl md:p-6"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="label-caps text-white">EcoMove · Visão Geral de Telemetria &amp; PostGIS</span>
              </div>
              <span className="font-mono text-[11px] text-zinc-400">
                SRID 4326 · ST_Intersects(CampusZone) · ST_DWithin(30m)
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#F7F7F5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/stitch/bi-dashboard.png"
                alt="EcoMove — Painel de Business Intelligence e Mapa Geoespacial PostGIS"
                className="w-full h-auto object-contain object-top"
              />
            </div>

            <div
              data-hero-portal-caption
              className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-white backdrop-blur-md sm:grid-cols-4"
            >
              <div>
                <p className="label-caps text-zinc-400">Geofence Universitário</p>
                <p className="mt-1 text-base font-semibold">Campus FACENS</p>
              </div>
              <div>
                <p className="label-caps text-zinc-400">Teto Diário de Viagens</p>
                <p className="mt-1 text-base font-semibold text-emerald-400">100 EcoPoints / dia</p>
              </div>
              <div>
                <p className="label-caps text-zinc-400">Deduplicação Espacial</p>
                <p className="mt-1 text-base font-semibold">Raio de 30 metros</p>
              </div>
              <div>
                <p className="label-caps text-zinc-400">Motor de Inteligência</p>
                <p className="mt-1 text-base font-semibold text-indigo-300">Gemini ⇄ Ollama</p>
              </div>
            </div>
          </div>
        </section>

        {/* PINNED 3-ACT STORYTELLER DECK (LEONIDA-STYLE SCRUBBED CHAPTER REVEALS) */}
        <section id="galeria" className="mx-auto mb-[140px] max-w-[1280px] px-6 md:px-8">
          {/* Desktop Pinned Scrub Experience */}
          <div
            ref={storyPinRef}
            className="hidden min-h-screen flex-col justify-center py-16 lg:flex"
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="label-caps rounded-full bg-[#E5E2E1] px-3.5 py-1.5 text-[#111111]">
                Arquitetura em 3 Atos · Role para Navegar Pelas Camadas
              </span>
              <span className="font-mono text-xs text-[#6B6B6B]">
                Design System Auralis · Gerado via Stitch MCP
              </span>
            </div>

            <div className="grid grid-cols-12 items-center gap-10 rounded-[28px] border border-[#E7E7E4] bg-[#F3F2EF] p-10">
              {/* Left 5 Cols: Scrubbed Narrative Chapters + Vertical Progress Rail */}
              <div className="relative col-span-5 flex min-h-[440px] items-center pl-6">
                <div className="absolute top-6 bottom-6 left-0 w-1 overflow-hidden rounded-full bg-[#E5E2E1]">
                  <div
                    data-story-progress
                    className="h-full w-full origin-top bg-[#111111]"
                  />
                </div>

                {STORY_CHAPTERS.map((item, idx) => (
                  <div
                    key={item.chapter}
                    data-story-text={idx}
                    className={`${
                      idx === 0 ? "relative opacity-100" : "pointer-events-none absolute inset-0 pl-6 opacity-0"
                    } flex flex-col justify-center space-y-5`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="label-caps rounded bg-[#111111] px-2.5 py-1 text-white">
                        {item.chapter}
                      </span>
                      <span className="label-caps rounded bg-[#FCFCFB] px-2.5 py-1 text-emerald-800">
                        {item.tag}
                      </span>
                    </div>
                    <h2 className="text-[36px] leading-[1.08] font-semibold tracking-[-0.03em] text-[#111111]">
                      {item.title}
                    </h2>
                    <p className="text-[16px] leading-[1.6] text-[#6B6B6B]">{item.subtitle}</p>
                    <ul className="space-y-2.5 border-t border-[#E7E7E4] pt-4 text-sm text-[#111111]">
                      {item.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Right 7 Cols: Scrubbed Visual Stage */}
              <div className="relative col-span-7 flex min-h-[540px] items-center justify-center overflow-hidden rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
                {STORY_CHAPTERS.map((item, idx) => (
                  <div
                    key={item.chapter}
                    data-story-card={idx}
                    className={`${
                      idx === 0 ? "relative opacity-100" : "pointer-events-none absolute inset-6 opacity-0"
                    } flex h-full w-full items-center justify-center`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className={
                        item.aspect === "mobile"
                          ? "max-h-[540px] w-auto rounded-[24px] border border-[#E7E7E4] object-contain shadow-lg"
                          : "max-h-[540px] w-full rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] object-contain object-top shadow-md"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile / Tablet Stacked Fallback */}
          <div className="space-y-8 lg:hidden">
            {STORY_CHAPTERS.map((item) => (
              <div
                key={item.chapter}
                className="space-y-5 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6"
              >
                <span className="label-caps rounded bg-[#111111] px-2.5 py-1 text-white">{item.chapter}</span>
                <h3 className="text-2xl font-semibold tracking-tight">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#6B6B6B]">{item.subtitle}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full rounded-2xl border border-[#E7E7E4] object-cover object-top"
                />
              </div>
            ))}
          </div>
        </section>

        {/* INTERACTIVE LIVE POSTGIS STAGE */}
        <section id="plataforma" data-scroll-section className="mx-auto mb-[160px] max-w-[1280px] px-6 md:px-8">
          <div data-scroll-item className="mb-8 flex items-center gap-4">
            <span className="label-caps rounded-full bg-[#E5E2E1] px-3.5 py-1.5 text-[#111111]">
              Demonstração Interativa · Geoprocessamento PostGIS Ao Vivo
            </span>
            <div className="h-px flex-grow bg-[#E7E7E4]" />
          </div>

          <div
            data-scroll-item
            className="relative flex min-h-[600px] flex-col justify-between overflow-hidden rounded-[28px] border border-[#E7E7E4] bg-[#F3F2EF] p-6 md:p-8"
          >
            {/* Atmospheric Gradient Orbs */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              <div
                data-orb-float
                className="absolute -ml-56 h-[320px] w-[320px] rounded-full bg-gradient-to-tr from-emerald-300/55 to-teal-200/55 blur-3xl"
              />
              <div
                data-orb-float
                className="absolute h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-indigo-300/45 to-sky-300/45 blur-3xl"
              />
              <div
                data-orb-float
                className="absolute mt-24 ml-64 h-[280px] w-[280px] rounded-full bg-gradient-to-tr from-amber-200/50 to-emerald-200/50 blur-3xl"
              />
            </div>

            {/* Top Segmented Controls */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap rounded-full border border-[#E7E7E4] bg-[#F7F7F5] p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("mobilidade")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "mobilidade"
                      ? "bg-[#FCFCFB] text-[#111111] shadow-2xs"
                      : "text-[#6B6B6B] hover:text-[#111111]"
                  }`}
                >
                  1. Perímetro CampusZone (PostGIS)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("zeladoria")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "zeladoria"
                      ? "bg-[#FCFCFB] text-[#111111] shadow-2xs"
                      : "text-[#6B6B6B] hover:text-[#111111]"
                  }`}
                >
                  2. Zeladoria Urbana &amp; Endossos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("bi")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "bi"
                      ? "bg-[#FCFCFB] text-[#111111] shadow-2xs"
                      : "text-[#6B6B6B] hover:text-[#111111]"
                  }`}
                >
                  3. Telemetria BI &amp; InsightEngine IA
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#E7E7E4] bg-[#FCFCFB]/90 px-4 py-2 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="label-caps text-[#111111]">PostGIS 3.4 · GiST Index Ativo</span>
              </div>
            </div>

            {/* Center Interactive Stage */}
            <div className="relative z-10 my-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {activeTab === "mobilidade" && (
                <>
                  <div className="lg:col-span-8">
                    <CampusZoneMapLoader zone={FACENS_PREVIEW_ZONE} heightClass="h-[420px]" />
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB]/90 p-6 backdrop-blur-md lg:col-span-4">
                    <div className="space-y-3">
                      <span className="label-caps rounded bg-emerald-500/10 px-2.5 py-1 text-emerald-800">
                        ST_Intersects &amp; ST_Length
                      </span>
                      <h3 className="text-2xl font-semibold tracking-tight">
                        Validação Espacial da CampusZone FACENS
                      </h3>
                      <p className="text-sm leading-relaxed text-[#6B6B6B]">
                        Todo deslocamento registrado pelo aplicativo Flutter é convertido em uma geometria{" "}
                        <code className="rounded bg-[#F3F2EF] px-1.5 py-0.5 font-mono text-xs text-[#111111]">
                          LineString (4326)
                        </code>{" "}
                        e validado diretamente no PostgreSQL/PostGIS contra o polígono oficial do campus.
                      </p>
                    </div>
                    <div className="mt-6 space-y-2.5 border-t border-[#E7E7E4] pt-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#6B6B6B]">Distância mínima elegível</span>
                        <span className="font-mono font-semibold">≥ 300 metros</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B6B6B]">Afiliação Institucional</span>
                        <span className="font-mono font-semibold">@facens.br auto-detectado</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B6B6B]">Resiliência Offline</span>
                        <span className="font-mono font-semibold">Fila local SQLite (Flutter)</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "zeladoria" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-12">
                  {HAZARD_CATEGORIES.map((item) => (
                    <div
                      key={item.code}
                      className="flex flex-col justify-between rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB]/95 p-6 backdrop-blur-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <span className="label-caps rounded bg-[#F3F2EF] px-2.5 py-1 text-[#111111]">{item.code}</span>
                        <span className="label-caps rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-900">
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="my-4">
                        <h4 className="text-xl font-semibold tracking-tight">{item.title}</h4>
                        <p className="mt-1 text-sm text-[#6B6B6B]">{item.desc}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#E7E7E4] pt-3 text-xs">
                        <span className="font-mono text-[#6B6B6B]">ST_DWithin(location, 30m)</span>
                        <span className="font-mono font-semibold text-[#111111]">
                          +{item.endorsements} confirmações (HazardEndorsement)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "bi" && (
                <div className="grid grid-cols-1 gap-6 lg:col-span-12 lg:grid-cols-12">
                  <div className="flex flex-col justify-between rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB]/95 p-6 backdrop-blur-md lg:col-span-7">
                    <div>
                      <span className="label-caps text-[#6B6B6B]">Distribuição Modal &amp; Emissões Evitadas</span>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                        Painel de Indicadores para Tomada de Decisão
                      </h3>
                    </div>
                    <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                        <p className="label-caps text-[#6B6B6B]">Caminhada</p>
                        <p className="mt-2 text-2xl font-semibold">38%</p>
                        <p className="mt-1 text-xs text-emerald-700">140g CO₂/km</p>
                      </div>
                      <div className="rounded-xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                        <p className="label-caps text-[#6B6B6B]">Bicicleta</p>
                        <p className="mt-2 text-2xl font-semibold">27%</p>
                        <p className="mt-1 text-xs text-emerald-700">140g CO₂/km</p>
                      </div>
                      <div className="rounded-xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                        <p className="label-caps text-[#6B6B6B]">Transporte Púb.</p>
                        <p className="mt-2 text-2xl font-semibold">21%</p>
                        <p className="mt-1 text-xs text-indigo-700">100g CO₂/km</p>
                      </div>
                      <div className="rounded-xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                        <p className="label-caps text-[#6B6B6B]">Carona (QR)</p>
                        <p className="mt-2 text-2xl font-semibold">14%</p>
                        <p className="mt-1 text-xs text-indigo-700">70g CO₂/km</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#6B6B6B]">
                      Referência científica: redução estimada de até 9,8% nas emissões individuais com feedback e
                      gamificação (Goetz et al., 2024; Bassanelli et al., 2025).
                    </p>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#1C1B1B] p-6 text-white lg:col-span-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="label-caps rounded bg-white/10 px-2.5 py-1 text-emerald-300">
                          InsightEngine Facade
                        </span>
                        <span className="font-mono text-xs text-zinc-400">Gemini Cloud ⇄ Ollama Local</span>
                      </div>
                      <h4 className="pt-2 text-xl font-semibold tracking-tight">
                        Diagnóstico Preditivo para Gestores
                      </h4>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        &ldquo;Corredor Oeste (Rod. Sen. José Ermírio de Moraes) concentra 64% dos trajetos de bicicleta
                        entre 18h00 e 19h15 e 24 endossos de iluminação precária. Recomenda-se priorizar manutenção
                        luminotécnica neste segmento.&rdquo;
                      </p>
                    </div>
                    <div className="mt-6 border-t border-white/10 pt-4 font-mono text-xs text-zinc-400">
                      ADR-0004: Interface plugável para execução em nuvem ou modelos locais no dispositivo.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Glass Status Bar */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB]/85 px-5 py-3.5 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#6B6B6B]">
                <span className="text-[#111111]">Arquitetura Monorepo</span>
                <span>• Flutter + BLoC + Provider (Mobile)</span>
                <span>• Fastify + Prisma + PostGIS (API)</span>
                <span>• Next.js 16 Server-First + React-Leaflet (Web)</span>
              </div>
              <Link
                href={isAuthenticatedManager ? "/painel" : "/login"}
                className="rounded-full bg-[#111111] px-5 py-2 text-xs font-medium text-white"
              >
                {isAuthenticatedManager ? "Ir para o Painel" : "Acessar Painel"}
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1: MOBILITY & GEOPROCESSING */}
        <section id="mobilidade" data-scroll-section className="mx-auto mb-[160px] max-w-[1280px] px-6 md:px-8">
          <div data-scroll-item className="mb-8 flex items-center gap-4">
            <span className="label-caps rounded-full bg-[#E5E2E1] px-3.5 py-1.5 text-[#111111]">
              01 · Mobilidade &amp; Geoprocessamento
            </span>
            <div className="h-px flex-grow bg-[#E7E7E4]" />
          </div>

          <div data-scroll-item className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <h2 className="text-[36px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[48px]">
                Quatro modais sustentáveis validados por regras espaciais.
              </h2>
            </div>
            <div className="flex items-end lg:col-span-5 lg:col-start-8">
              <p className="text-[17px] leading-[1.6] text-[#6B6B6B]">
                Cada viagem (<code className="font-mono text-sm text-[#111111]">Trip</code>) passa por verificação de
                intersecção com a <code className="font-mono text-sm text-[#111111]">CampusZone</code>, distância mínima
                de 300 metros e limites de velocidade por modal, evitando fraudes e garantindo dados confiáveis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TRANSPORT_MODES.map((mode) => (
              <div
                key={mode.code}
                data-scroll-item
                className="flex flex-col justify-between rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="label-caps rounded bg-[#F3F2EF] px-2.5 py-1 text-[#111111]">{mode.code}</span>
                    <span className="text-xs font-medium text-emerald-700">{mode.badge}</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight">{mode.label}</h3>
                  <p className="mt-2 text-sm text-[#6B6B6B]">{mode.speed}</p>
                </div>
                <div className="mt-8 space-y-2 border-t border-[#E7E7E4] pt-4">
                  <div className="text-base font-semibold text-[#111111]">{mode.points}</div>
                  <div className="font-mono text-xs text-[#6B6B6B]">{mode.co2}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: CITIZEN URBAN MAINTENANCE (ZELADORIA) */}
        <section id="zeladoria" data-scroll-section className="mx-auto mb-[160px] max-w-[1280px] px-6 md:px-8">
          <div data-scroll-item className="mb-8 flex items-center gap-4">
            <span className="label-caps rounded-full bg-[#E5E2E1] px-3.5 py-1.5 text-[#111111]">
              02 · Zeladoria Urbana Cidadã
            </span>
            <div className="h-px flex-grow bg-[#E7E7E4]" />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div
              data-scroll-item
              className="flex flex-col justify-between rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-8 lg:col-span-7"
            >
              <div className="space-y-4">
                <span className="label-caps text-emerald-800">Deduplicação Espacial PostGIS · 30 Metros</span>
                <h2 className="text-[32px] leading-[1.12] font-semibold tracking-[-0.03em] sm:text-[42px]">
                  Menos ruído para o gestor, mais prioridade para o que importa.
                </h2>
                <p className="text-[16px] leading-relaxed text-[#6B6B6B]">
                  Quando um estudante ou colaborador reporta um problema de infraestrutura (
                  <code className="font-mono text-sm text-[#111111]">HazardReport</code>), o backend executa{" "}
                  <code className="font-mono text-sm text-[#111111]">ST_DWithin(30m)</code>. Se já houver uma ocorrência
                  ativa da mesma categoria, o aplicativo propõe um endosso (
                  <code className="font-mono text-sm text-[#111111]">HazardEndorsement</code>) em um toque.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[#E7E7E4] pt-6 sm:grid-cols-4">
                <div>
                  <span className="label-caps text-[#6B6B6B]">1. Registro</span>
                  <p className="mt-1 text-sm font-semibold">PENDING</p>
                </div>
                <div>
                  <span className="label-caps text-[#6B6B6B]">2. Endossos</span>
                  <p className="mt-1 text-sm font-semibold">+Prioridade</p>
                </div>
                <div>
                  <span className="label-caps text-[#6B6B6B]">3. Validação</span>
                  <p className="mt-1 text-sm font-semibold">APPROVED (+25 pts)</p>
                </div>
                <div>
                  <span className="label-caps text-[#6B6B6B]">4. Reparo</span>
                  <p className="mt-1 text-sm font-semibold">RESOLVED</p>
                </div>
              </div>
            </div>

            <div
              data-scroll-item
              className="flex flex-col justify-between rounded-[24px] border border-[#E7E7E4] bg-[#F3F2EF] p-8 lg:col-span-5"
            >
              <div className="space-y-3">
                <span className="label-caps rounded bg-[#FCFCFB] px-2.5 py-1 text-[#111111]">
                  ADR-0005 · Firebase Spark Ready
                </span>
                <h3 className="text-2xl font-semibold tracking-tight">Evidência Fotográfica Otimizada</h3>
                <p className="text-sm leading-relaxed text-[#6B6B6B]">
                  As fotos capturadas em campo são comprimidas no próprio dispositivo para{" "}
                  <strong className="font-medium text-[#111111]">WebP (&lt; 300 KB)</strong> antes do envio ao{" "}
                  <code className="font-mono text-xs text-[#111111]">MediaStorageService</code>, mantendo custo zero de
                  infraestrutura.
                </p>
              </div>
              <div className="mt-6 rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-5">
                <p className="label-caps text-[#6B6B6B]">Persona 1 · Usuária da Mobilidade</p>
                <p className="mt-2 text-base font-medium italic">
                  &ldquo;Eu já ando de bike quase todo dia — só faltava algo que reconhecesse isso e um canal para
                  relatar problemas nas calçadas e ciclovias.&rdquo;
                </p>
                <p className="mt-2 text-xs text-[#6B6B6B]">Beatriz Andrade Souza, 21 anos — Estudante Universitária</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ECOPOINTS LEDGER & REWARDS */}
        <section id="economia" data-scroll-section className="mx-auto mb-[160px] max-w-[1280px] px-6 md:px-8">
          <div data-scroll-item className="mb-8 flex items-center gap-4">
            <span className="label-caps rounded-full bg-[#E5E2E1] px-3.5 py-1.5 text-[#111111]">
              03 · Economia Gamificada &amp; Ledger Imutável
            </span>
            <div className="h-px flex-grow bg-[#E7E7E4]" />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div
              data-scroll-item
              className="flex flex-col justify-between rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-8 lg:col-span-6"
            >
              <div>
                <span className="label-caps text-[#6B6B6B]">ADR-0003 · PointTransaction Ledger</span>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                  Carteira auditável com estorno automático em 7 dias.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                  O saldo de <code className="font-mono text-xs text-[#111111]">EcoPoints</code> nunca é mutado
                  isoladamente: cada crédito de trajeto, bônus de ocorrência aprovada ou resgate de benefício gera uma
                  transação atômica no banco de dados.
                </p>
              </div>
              <div className="mt-8 divide-y divide-[#E7E7E4] border-t border-[#E7E7E4] text-sm">
                <div className="flex items-center justify-between py-3.5">
                  <span className="font-mono text-xs">TRIP_VALIDATED (Bicicleta · 3,5 km)</span>
                  <span className="font-mono font-semibold text-emerald-700">+28 EcoPoints</span>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <span className="font-mono text-xs">HAZARD_APPROVED (Calçada Danificada)</span>
                  <span className="font-mono font-semibold text-emerald-700">+25 EcoPoints</span>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <span className="font-mono text-xs">REWARD_REDEEMED (Café Parceiro Campus)</span>
                  <span className="font-mono font-semibold text-[#111111]">-40 EcoPoints</span>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <span className="font-mono text-xs">REDEMPTION_EXPIRED_REFUND (Voucher &gt; 7d)</span>
                  <span className="font-mono font-semibold text-indigo-700">+40 EcoPoints (Estorno)</span>
                </div>
              </div>
            </div>

            <div
              data-scroll-item
              className="flex flex-col justify-between rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-8 lg:col-span-6"
            >
              <div>
                <span className="label-caps text-[#6B6B6B]">Persona 2 · Gestor de Mobilidade</span>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                  &ldquo;Eu preciso de dados para justificar onde investir — não só boa vontade.&rdquo;
                </h3>
                <p className="mt-2 text-xs text-[#6B6B6B]">
                  Ricardo Melo Fontoura, 38 anos — Coordenador de Infraestrutura do Campus
                </p>
              </div>

              <div id="inteligencia" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                  <span className="label-caps text-[#6B6B6B]">BPMN</span>
                  <p className="mt-2 text-sm font-semibold">Processos Modelados</p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    Fluxos claros entre Usuários da Mobilidade e Gestores.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                  <span className="label-caps text-[#6B6B6B]">BI</span>
                  <p className="mt-2 text-sm font-semibold">Mapas de Calor</p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    Corredores mais utilizados, horários de pico e ocorrências.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-4">
                  <span className="label-caps text-[#6B6B6B]">IA</span>
                  <p className="mt-2 text-sm font-semibold">InsightEngine</p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    Recomendações de infraestrutura e nudges personalizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: TEAM & ODS ALIGNMENT */}
        <section id="equipe" data-scroll-section className="mx-auto max-w-[1280px] px-6 md:px-8">
          <div data-scroll-item className="mb-8 flex items-center gap-4">
            <span className="label-caps rounded-full bg-[#E5E2E1] px-3.5 py-1.5 text-[#111111]">
              04 · Grupo DevPro (UPX IV) &amp; Objetivos da ONU
            </span>
            <div className="h-px flex-grow bg-[#E7E7E4]" />
          </div>

          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div data-scroll-item className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
              <span className="label-caps text-emerald-800">ODS 11 · Meta 11.2 &amp; 11.6</span>
              <h4 className="mt-3 text-xl font-semibold">Cidades e Comunidades Sustentáveis</h4>
              <p className="mt-2 text-sm text-[#6B6B6B]">
                Acesso a sistemas de transporte seguros, acessíveis e sustentáveis e redução do impacto ambiental no
                entorno universitário.
              </p>
            </div>
            <div data-scroll-item className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
              <span className="label-caps text-emerald-800">ODS 13 · Descarbonização</span>
              <h4 className="mt-3 text-xl font-semibold">Ação Contra a Mudança Global do Clima</h4>
              <p className="mt-2 text-sm text-[#6B6B6B]">
                Substituição de deslocamentos individuais motorizados por caminhada, bicicleta, transporte público e
                caronas solidárias.
              </p>
            </div>
            <div data-scroll-item className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
              <span className="label-caps text-emerald-800">ODS 9 · Geotecnologia</span>
              <h4 className="mt-3 text-xl font-semibold">Indústria, Inovação e Infraestrutura</h4>
              <p className="mt-2 text-sm text-[#6B6B6B]">
                Monitoramento geoespacial em PostGIS e priorização de obras viárias baseada em dados reais.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.ra}
                data-scroll-item
                className="flex flex-col justify-between rounded-2xl border border-[#E7E7E4] bg-[#F3F2EF] p-5"
              >
                <div>
                  <span className="label-caps text-[#6B6B6B]">{member.ra}</span>
                  <h4 className="mt-2 text-base font-semibold text-[#111111]">{member.name}</h4>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[#6B6B6B]">{member.role}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* MINIMAL ARCHITECTURAL FOOTER */}
      <footer className="border-t border-[#E7E7E4] bg-[#F3F2EF]">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-6 py-12 text-sm text-[#6B6B6B] sm:flex-row sm:items-center md:px-8">
          <div>
            <span className="font-semibold text-[#111111]">EcoMove · DevPro</span> — Usina de Projetos Experimentais IV
            (Centro Universitário Facens, Sorocaba/SP · 2026)
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-[#111111] underline-offset-4 hover:underline">
              Portal do Gestor
            </Link>
            <a
              href="https://github.com/LuizJarduli/Ecomove"
              target="_blank"
              rel="noreferrer"
              className="text-[#111111] underline-offset-4 hover:underline"
            >
              GitHub Monorepo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
