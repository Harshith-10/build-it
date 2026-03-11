"use client";

import { motion } from "motion/react";
import Image from "next/image";

const team = [
  {
    name: "Gautham Sharma",
    role: "Full-Stack Developer",
    image: "/team/gautham.png",
    message: "It works on my machine!!",
  },
  {
    name: "Jaya Raj Vavilapalli",
    role: "DevSecOps Engineer",
    image: "/team/jayaraj.jpg",
    message: "Hippity hoppity, your code is my property.",
  },
  {
    name: "Harshith Doddipalli",
    role: "Founder + Lead Engineer",
    image: "/team/harshith.jpg",
    message: "What is love? Baby don't hurt me, don't hurt me, no more.",
  },
  {
    name: "Rohith Gona",
    role: "Full-Stack Developer",
    image: "/team/rohith.jpg",
    message: "I write bugs so the security guy has a job.",
  },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function TeamSection() {
  return (
    <section className="relative py-24 md:py-32 border-t border-border dark:bg-[#09090b] text-foreground dark:text-white overflow-hidden">
      {/* Subtle grid */}
      {/* <div className="absolute inset-0 landing-grid-bg opacity-40 dark:opacity-10" /> */}

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
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
              06
            </span>
            <div className="h-px w-8 bg-border" />
            <span className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
              Team
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Meet the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500 dark:from-emerald-400 dark:to-cyan-400">
              Devs
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl google-sans leading-relaxed">
            A focused team of engineers united by a single goal: to build the
            most reliable assessment platform in existence.
          </p>
        </motion.div>

        {/* Team grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
        >
          {team.map((member) => (
            <motion.div key={member.name} variants={fadeUp} className="group">
              {/* Photo container */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted dark:bg-white/[0.04] mb-5">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className="object-cover hover:scale-105 transition-all duration-500 ease-out"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                {/* Subtle bottom gradient for text legibility */}
                {member.message && (
                  <div className="flex italic pointer-events-none google-sans items-end justify-center pb-4 px-4 text-center absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <p className="text-sm text-white">{`"${member.message}"`}</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="space-y-1">
                <h3 className="font-semibold text-sm md:text-base tracking-tight text-foreground dark:text-white">
                  {member.name}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground google-sans">
                  {member.role}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
