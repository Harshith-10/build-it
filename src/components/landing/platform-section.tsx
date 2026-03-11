"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";

export function PlatformSection() {
  return (
    <section
      id="platform"
      className="relative py-24 md:py-32 border-t border-border"
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
              04
            </span>
            <div className="h-px w-8 bg-border" />
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Platform
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Built for the Way You{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Work
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl google-sans leading-relaxed">
            A thoughtfully designed interface that removes friction between
            thinking and doing. Every pixel serves a purpose.
          </p>
        </motion.div>

        {/* Platform mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="rounded-xl border border-white/[0.08] bg-[#09090b] overflow-hidden shadow-2xl">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-[#ff5f57]" />
                  <div className="size-3 rounded-full bg-[#febc2e]" />
                  <div className="size-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[11px] text-white/30 font-mono">
                  BuildIT — Exam Environment
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400 text-[10px] bg-transparent"
                >
                  Session Active
                </Badge>
                <span className="text-[10px] text-white/20 font-mono tabular-nums">
                  42:18 remaining
                </span>
              </div>
            </div>

            {/* Main content area */}
            <div className="grid lg:grid-cols-[260px_1fr] min-h-[420px]">
              {/* Sidebar — Problem list */}
              <div className="border-r border-white/[0.06] p-4 hidden lg:block">
                <div className="text-[10px] text-white/25 font-mono tracking-[0.2em] uppercase mb-4">
                  Problems
                </div>
                {[
                  {
                    id: "01",
                    name: "Two Sum",
                    diff: "Easy",
                    color: "text-emerald-400",
                    active: true,
                  },
                  {
                    id: "02",
                    name: "Valid Parentheses",
                    diff: "Easy",
                    color: "text-emerald-400",
                    active: false,
                  },
                  {
                    id: "03",
                    name: "Merge Intervals",
                    diff: "Medium",
                    color: "text-yellow-400",
                    active: false,
                  },
                  {
                    id: "04",
                    name: "LRU Cache",
                    diff: "Hard",
                    color: "text-red-400",
                    active: false,
                  },
                  {
                    id: "05",
                    name: "Binary Search",
                    diff: "Easy",
                    color: "text-emerald-400",
                    active: false,
                  },
                ].map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] mb-0.5 transition-colors ${
                      p.active
                        ? "bg-white/[0.05] text-white"
                        : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-white/20 tabular-nums w-5 shrink-0">
                      {p.id}
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span
                      className={`text-[10px] font-medium shrink-0 ${p.color}`}
                    >
                      {p.diff}
                    </span>
                  </div>
                ))}
              </div>

              {/* Editor pane */}
              <div className="flex flex-col">
                {/* Tab bar */}
                <div className="flex items-center border-b border-white/[0.06] px-1">
                  <div className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-white/80 border-b-2 border-primary">
                    <span className="font-mono">solution.py</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-white/25">
                    <span className="font-mono">test_cases.py</span>
                  </div>
                </div>

                {/* Code content */}
                <div className="flex-1 px-5 py-4 font-mono text-[13px] leading-7 text-white overflow-x-auto">
                  <div className="flex gap-5">
                    <div className="text-white/15 select-none text-right shrink-0">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <Line>
                        <Kw>def</Kw> <Fn>two_sum</Fn>
                        <P>(</P>nums<P>:</P> <Tp>list</Tp>
                        <P>[</P>
                        <Tp>int</Tp>
                        <P>]</P>, target<P>:</P> <Tp>int</Tp>
                        <P>)</P> <P>-&gt;</P> <Tp>list</Tp>
                        <P>[</P>
                        <Tp>int</Tp>
                        <P>]:</P>
                      </Line>
                      <Line>
                        {"    "}
                        <Cm># Hash map approach — O(n) time</Cm>
                      </Line>
                      <Line>
                        {"    "}seen <Op>=</Op> <Br>{"{}"}</Br>
                      </Line>
                      <Line>
                        {"    "}
                        <Kw>for</Kw> i, num <Kw>in</Kw> <Bi>enumerate</Bi>
                        <P>(</P>nums<P>):</P>
                      </Line>
                      <Line>
                        {"        "}complement <Op>=</Op> target <Op>-</Op> num
                      </Line>
                      <Line>
                        {"        "}
                        <Kw>if</Kw> complement <Kw>in</Kw> seen
                        <P>:</P>
                      </Line>
                      <Line>
                        {"            "}
                        <Kw>return</Kw> <P>[</P>seen
                        <P>[</P>complement<P>]</P>, i<P>]</P>
                      </Line>
                      <Line>
                        {"        "}seen<P>[</P>num<P>]</P> <Op>=</Op> i
                      </Line>
                      <Line>
                        {"    "}
                        <Kw>return</Kw> <P>[]</P>
                      </Line>
                      <Line>&nbsp;</Line>
                      <Line>
                        <Cm># Complexity: Time O(n), Space O(n)</Cm>
                      </Line>
                      <Line>&nbsp;</Line>
                    </div>
                  </div>
                </div>

                {/* Terminal / Output area */}
                <div className="border-t border-white/[0.06] p-4 bg-white/[0.015]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] text-white/25 font-mono tracking-[0.15em] uppercase">
                      Output
                    </span>
                    <div className="h-px flex-1 bg-white/[0.04]" />
                  </div>
                  <div className="font-mono text-[12px] space-y-1">
                    <div className="text-white/30">Running 3 test cases...</div>
                    <div className="text-emerald-400/80">
                      <span className="text-emerald-400">✓</span> Test 1:{" "}
                      <span className="text-white/40">[2,7], target=9</span> →
                      [0,1]{" "}
                      <span className="text-white/15 tabular-nums">0.01ms</span>
                    </div>
                    <div className="text-emerald-400/80">
                      <span className="text-emerald-400">✓</span> Test 2:{" "}
                      <span className="text-white/40">[3,2,4], target=6</span> →
                      [1,2]{" "}
                      <span className="text-white/15 tabular-nums">0.01ms</span>
                    </div>
                    <div className="text-emerald-400/80">
                      <span className="text-emerald-400">✓</span> Test 3:{" "}
                      <span className="text-white/40">[3,3], target=6</span> →
                      [0,1]{" "}
                      <span className="text-white/15 tabular-nums">0.01ms</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/[0.04] text-emerald-400 font-medium flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-emerald-400" />
                      All 3 test cases passed
                      <span className="text-white/20 ml-auto tabular-nums font-normal">
                        Total: 0.03ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Platform features beneath the mockup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid sm:grid-cols-3 gap-8 mt-12"
        >
          {[
            {
              label: "Sandboxed Runtime",
              desc: "Each submission runs in an isolated container with strict resource limits and network isolation.",
            },
            {
              label: "Instant Feedback",
              desc: "Results appear in milliseconds with detailed test case breakdowns and memory profiling.",
            },
            {
              label: "Browser Lockdown",
              desc: "Full-screen enforcement, clipboard blocking, and tab-switch prevention during active exams.",
            },
          ].map((item) => (
            <div key={item.label} className="space-y-2">
              <h4 className="text-sm font-semibold tracking-tight">
                {item.label}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed google-sans">
                {item.desc}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* Syntax highlight helpers */
function Line({ children }: { children: React.ReactNode }) {
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
function Tp({ children }: { children: React.ReactNode }) {
  return <span className="text-cyan-300">{children}</span>;
}
function P({ children }: { children: React.ReactNode }) {
  return <span className="text-white/40">{children}</span>;
}
function Op({ children }: { children: React.ReactNode }) {
  return <span className="text-white/50">{children}</span>;
}
function Br({ children }: { children: React.ReactNode }) {
  return <span className="text-orange-400">{children}</span>;
}
function Cm({ children }: { children: React.ReactNode }) {
  return <span className="text-white/25 italic">{children}</span>;
}
