"use client";

import { BarChart3, Building2, Code2, Eye, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";

const features = [
  {
    icon: Shield,
    title: "Secure Examination Engine",
    description:
      "Enterprise-grade security with browser lockdown, session isolation, and anti-cheating protocols that ensure absolute assessment integrity.",
    accent: "oklch(88% 0.23 140)",
  },
  {
    icon: Zap,
    title: "Real-Time Code Execution",
    description:
      "Compile and execute code instantly across multiple languages with sandboxed, containerized runtime environments built for speed.",
    accent: "oklch(80% 0.22 85)",
  },
  {
    icon: Code2,
    title: "Multi-Language Support",
    description:
      "Full support for Python, C++, Java, JavaScript, Rust, and more—with intelligent syntax highlighting and language-aware tooling.",
    accent: "oklch(75% 0.18 200)",
  },
  {
    icon: Eye,
    title: "Intelligent Proctoring",
    description:
      "Comprehensive monitoring with tab-switch detection, clipboard control, window focus tracking, and detailed activity logging.",
    accent: "oklch(55% 0.24 25)",
  },
  {
    icon: BarChart3,
    title: "Comprehensive Analytics",
    description:
      "Detailed performance analytics with submission timelines, difficulty distribution, score breakdowns, and exportable reports.",
    accent: "oklch(65% 0.25 310)",
  },
  {
    icon: Building2,
    title: "Institutional Management",
    description:
      "Manage users, groups, semesters, and sections with granular role-based access control designed for academic institutions.",
    accent: "oklch(55% 0.245 262.881)",
  },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function FeaturesSection() {
  return (
    <section
      id="capabilities"
      className="relative py-24 md:py-32 border-t border-border"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
              02
            </span>
            <div className="h-px w-8 bg-border" />
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Capabilities
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Engineered for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">
              Excellence
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl google-sans leading-relaxed">
            Every feature precision-crafted to deliver institutional-grade
            assessment experiences with zero compromise.
          </p>
        </motion.div>

        {/* Feature cards grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-16"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              className="group relative p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow duration-200"
            >
              {/* Accent bar */}
              <div
                className="absolute top-0 left-6 right-6 h-[2px] rounded-full opacity-80"
                style={{ backgroundColor: feature.accent }}
              />

              <div
                className="flex items-center justify-center size-10 rounded-lg mb-5"
                style={{
                  backgroundColor: `color-mix(in oklch, ${feature.accent} 12%, transparent)`,
                }}
              >
                <feature.icon
                  className="size-[18px]"
                  style={{ color: feature.accent }}
                />
              </div>

              <h3 className="font-semibold mb-2.5 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed google-sans">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
