"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative py-24 md:py-32 border-t border-border overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 landing-grid-bg opacity-50 dark:opacity-100" />

      {/* Vertical accent bars from top */}
      {/* <div className="absolute top-0 left-[25%] w-px h-16 bg-primary/30" />
      <div className="absolute top-0 left-[50%] w-px h-24 bg-primary/20" />
      <div className="absolute top-0 left-[75%] w-px h-12 bg-primary/30" /> */}

      {/* Subtle glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/[0.04] dark:bg-primary/[0.09] rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto space-y-8"
        >
          {/* Section label */}
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
              07
            </span>
            <div className="h-px w-8 bg-border" />
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Begin
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
            Ready to Transform
            <br />
            <span className="text-primary">Your Assessments?</span>
          </h2>

          {/* Description */}
          <p className="text-lg text-muted-foreground google-sans leading-relaxed max-w-lg mx-auto">
            Join the platform engineered for precision, designed for excellence,
            and built for the future of competitive assessment.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button size="lg" asChild className="px-8">
              <Link href={isAuthenticated ? "/redirect" : "/auth/sign-in"}>
                {isAuthenticated ? "Go to Dashboard" : "Start Building"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
