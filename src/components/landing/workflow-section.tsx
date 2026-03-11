"use client";

import { LineChart, PenTool, Rocket, Settings } from "lucide-react";
import { motion } from "motion/react";

const steps = [
  {
    number: "01",
    title: "Configure",
    description:
      "Set up examination parameters, question banks, time limits, and scoring rubrics with precision control.",
    icon: Settings,
    accent: "oklch(0.546 0.245 262.881)",
  },
  {
    number: "02",
    title: "Deploy",
    description:
      "Launch secure exam sessions with institutional-grade access control, scheduling, and real-time monitoring.",
    icon: Rocket,
    accent: "oklch(0.637 0.237 25.331)",
  },
  {
    number: "03",
    title: "Assess",
    description:
      "Students code, compile, and submit solutions in a controlled, proctored real-time environment.",
    icon: PenTool,
    accent: "oklch(0.879 0.169 91.605)",
  },
  {
    number: "04",
    title: "Analyze",
    description:
      "Generate comprehensive analytics, automated grading reports, and performance insights instantly.",
    icon: LineChart,
    accent: "oklch(0.723 0.219 149.579)",
  },
];

export function WorkflowSection() {
  return (
    <section
      id="process"
      className="relative py-24 md:py-32 border-t border-border bg-muted/30 dark:bg-muted/10"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
              05
            </span>
            <div className="h-px w-8 bg-border" />
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Process
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            From Setup to Insight
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl google-sans leading-relaxed">
            A systematic, four-step workflow designed for maximum efficiency and
            zero friction.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative"
            >
              {/* Connector line (desktop only) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-7 w-full h-px mx-4 bg-border translate-x-10 z-0" />
              )}

              <div className="space-y-5">
                {/* Icon */}
                <div
                  className="flex items-center justify-center size-14 rounded-xl border border-border z-10"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${step.accent} 8%, var(--background))`,
                  }}
                >
                  <step.icon
                    className="size-6"
                    style={{ color: step.accent }}
                    strokeWidth={1.5}
                  />
                </div>

                {/* Label */}
                <div>
                  <span className="font-mono text-[11px] text-muted-foreground tracking-[0.2em]">
                    {step.number}
                  </span>
                  <h3 className="text-xl font-semibold mt-1.5 tracking-tight">
                    {step.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed google-sans">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
