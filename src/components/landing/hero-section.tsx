"use client";

import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function HeroSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Swiss grid background */}
      <div className="absolute inset-0 landing-grid-bg opacity-60 dark:opacity-100" />

      {/* Geometric accent lines — Swiss style functional color bars */}
      {/* <div className="absolute top-[22%] left-0 w-20 lg:w-32 h-[3px] bg-[oklch(0.637_0.237_25.331)] shaku" />
      <div className="absolute top-[68%] right-0 w-16 lg:w-24 h-[3px] bg-[oklch(0.546_0.245_262.881)] shaku" />
      <div className="absolute bottom-[15%] left-[5%] w-12 lg:w-20 h-[3px] bg-[oklch(0.879_0.169_91.605)] shaku" /> */}

      {/* Subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/[0.03] dark:bg-primary/[0.06] rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 w-full py-16">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="grid lg:grid-cols-12 gap-16 lg:gap-8 items-center"
        >
          {/* Left content — text block */}
          <div className="lg:col-span-7 space-y-8">
            {/* Section indicator */}
            <motion.div variants={item} className="flex items-center gap-3">
              <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
                01
              </span>
              <div className="h-px w-8 bg-primary" />
              <Badge
                variant="outline"
                className="text-[10px] tracking-[0.15em] uppercase font-medium"
              >
                Assessment Platform
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={item}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight leading-[0.92]"
            >
              Precision–
              <br />
              Engineered
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-500">
                Assessment
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={item}
              className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed google-sans"
            >
              Where competitive programming meets institutional excellence.{" "}
              <span className="text-black dark:text-white">
                Code, compile, and conquer
              </span>
              —with absolute confidence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={item}
              className="flex flex-wrap items-center gap-4"
            >
              <Button size="lg" asChild>
                <Link href={isAuthenticated ? "/redirect" : "/auth/sign-in"}>
                  {isAuthenticated ? "Go to Dashboard" : "Get Started"}
                  <ArrowRight />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#capabilities">Explore Platform</a>
              </Button>
            </motion.div>
          </div>

          {/* Right — Code editor preview */}
          <motion.div variants={item} className="lg:col-span-5">
            <CodePreview />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 hidden md:block"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <ChevronDown className="size-5 text-muted-foreground" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mock code editor — always dark for contrast                                */
/* -------------------------------------------------------------------------- */

function CodePreview() {
  const [step, setStep] = useState<"typing" | "running" | "done">("typing");

  useEffect(() => {
    if (step === "typing") {
      const timer = setTimeout(() => setStep("running"), 2000);
      return () => clearTimeout(timer);
    } else if (step === "running") {
      const timer = setTimeout(() => setStep("done"), 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const CODE_LINES = [
    <CodeLine key="1">
      <Kw>def</Kw> <Fn>two_sum</Fn>
      <Pn>(</Pn>nums, target<Pn>):</Pn>
    </CodeLine>,
    <CodeLine key="2">
      {"    "}seen <Op>=</Op> <Br>{"{}"}</Br>
    </CodeLine>,
    <CodeLine key="3">
      {"    "}
      <Kw>for</Kw> i, num <Kw>in</Kw> <Bi>enumerate</Bi>
      <Pn>(</Pn>nums<Pn>):</Pn>
    </CodeLine>,
    <CodeLine key="4">
      {"        "}comp <Op>=</Op> target <Op>-</Op> num
    </CodeLine>,
    <CodeLine key="5">
      {"        "}
      <Kw>if</Kw> comp <Kw>in</Kw> seen<Pn>:</Pn>
    </CodeLine>,
    <CodeLine key="6">
      {"            "}
      <Kw>return</Kw> <Pn>[</Pn>seen<Pn>[</Pn>comp
      <Pn>]</Pn>, i<Pn>]</Pn>
    </CodeLine>,
    <CodeLine key="7">
      {"        "}seen<Pn>[</Pn>num<Pn>]</Pn> <Op>=</Op> i
    </CodeLine>,
    <CodeLine key="8">
      {"    "}
      <Kw>return</Kw> <Pn>[]</Pn>
    </CodeLine>,
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#09090b] text-white overflow-hidden shadow-2xl dark:border-white/[0.06]">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-[#ff5f57]" />
            <div className="size-3 rounded-full bg-[#febc2e]" />
            <div className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] text-white/30 font-mono ml-1">
            solution.py
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-500/30 text-emerald-400 text-[10px] bg-transparent"
        >
          Python 3.12
        </Badge>
      </div>

      {/* Code body */}
      <div className="px-5 py-4 font-mono text-[13px] leading-7 overflow-x-auto min-h-[280px]">
        <div className="flex gap-5">
          {/* Line numbers */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.15 } },
            }}
            className="text-white/15 select-none text-right shrink-0"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <motion.div
                key={n}
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { duration: 0.1 } },
                }}
              >
                {n}
              </motion.div>
            ))}
          </motion.div>

          {/* Code */}
          <motion.div
            className="min-w-0"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.15 } },
            }}
          >
            {CODE_LINES.map((line) => (
              <motion.div
                key={line.key as React.Key}
                variants={{
                  hidden: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
                  visible: {
                    opacity: 1,
                    clipPath: "inset(0 0 0 0)",
                    transition: { duration: 0.3, ease: "linear" },
                  },
                }}
              >
                {line}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Terminal output */}
      <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.015] h-[80px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {step === "typing" ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white/20 font-mono text-xs"
            >
              Waiting for input...
            </motion.div>
          ) : step === "running" ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="text-white/30 font-mono text-xs">
                $ python solution.py
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <Loader2 className="size-3.5 animate-spin text-emerald-400" />
                <span className="text-emerald-400/80">Executing tests...</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="text-white/30 font-mono text-xs">
                $ python solution.py
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-emerald-400">✓</span>
                <span className="text-emerald-400/80">
                  All test cases passed
                </span>
                <span className="text-white/20 ml-auto tabular-nums">
                  0.04ms
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* Syntax highlight helper components */
function CodeLine({ children }: { children: React.ReactNode }) {
  return <div className="whitespace-pre">{children}</div>;
}
function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-400">{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-yellow-300">{children}</span>;
}
function Bi({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-400">{children}</span>;
}
function Pn({ children }: { children: React.ReactNode }) {
  return <span className="text-white/40">{children}</span>;
}
function Op({ children }: { children: React.ReactNode }) {
  return <span className="text-white/50">{children}</span>;
}
function Br({ children }: { children: React.ReactNode }) {
  return <span className="text-orange-400">{children}</span>;
}
