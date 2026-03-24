import { headers } from "next/headers";
import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { LenisProvider } from "@/components/landing/lenis-provider";
import { MetricsSection } from "@/components/landing/metrics-section";
import { PlatformSection } from "@/components/landing/platform-section";
import { TeamSection } from "@/components/landing/team-section";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isAuthenticated = !!session?.user;

  return (
    <LenisProvider>
      <div className="relative min-h-screen bg-background">
        <LandingNav isAuthenticated={isAuthenticated} />
        <main>
          <HeroSection isAuthenticated={isAuthenticated} />
          <FeaturesSection />
          <MetricsSection />
          <PlatformSection />
          <WorkflowSection />
          <TeamSection />
          <CtaSection isAuthenticated={isAuthenticated} />
        </main>
        <LandingFooter />
      </div>
    </LenisProvider>
  );
}
