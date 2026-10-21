import { LandingShowcase } from "@/components/landing-showcase";
import { getSession } from "@/lib/dal";

export default async function HomePage() {
  const session = await getSession();
  return <LandingShowcase isAuthenticatedManager={session.status === "manager"} />;
}
