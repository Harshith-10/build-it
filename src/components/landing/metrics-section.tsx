"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

const metrics = [
  { value: 2000, suffix: "+", label: "Active Users" },
  { value: 10000, suffix: "+", label: "Submissions Processed" },
  { value: 10, suffix: "+", label: "Exams Conducted" },
  { value: 8, suffix: "", label: "Languages Supported" },
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return controls.stop;
  }, [isInView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export function MetricsSection() {
  return (
    <section className="relative py-24 md:py-32 border-t border-border bg-muted/30 dark:bg-muted/10">
      {/* Horizontal rule accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-primary/40" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
              03
            </span>
            <div className="h-px w-8 bg-border" />
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Impact
            </span>
          </div>
        </motion.div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="space-y-3"
            >
              <div className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-none">
                <AnimatedCounter value={metric.value} suffix={metric.suffix} />
              </div>
              <div className="text-sm text-muted-foreground font-medium tracking-wide google-sans">
                {metric.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
