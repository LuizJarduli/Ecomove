import { LandingShowcase } from "@/components/landing-showcase";

export default function HomePage() {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? "#plataforma";
  return <LandingShowcase portalUrl={portalUrl} />;
}
