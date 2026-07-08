'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Menu,
  X,
  Sparkles,
  Mic,
  Play,
  ChevronRight,
  MessageSquare,
  FileText,
  ArrowRight,
  Plus,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function FadeInUp({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 1, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   SVG Logo
   ───────────────────────────────────────────── */

function PletyLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="Plety"
    >
      {/* Geometric hexagonal mark */}
      <path
        d="M20 4L36 12V28L20 36L4 28V12L20 4Z"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M20 12L28 16V24L20 28L12 24V16L20 12Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="3" fill="white" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Dummy brand SVG logos for marquee
   ───────────────────────────────────────────── */

const brandLogos = [
  <svg key="1" viewBox="0 0 100 32" className="h-6 w-auto opacity-50" fill="none">
    <rect x="4" y="4" width="24" height="24" rx="6" stroke="white" strokeWidth="1.5" />
    <path d="M14 14L22 14M14 18L20 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>,
  <svg key="2" viewBox="0 0 100 32" className="h-6 w-auto opacity-50" fill="none">
    <circle cx="16" cy="16" r="12" stroke="white" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="5" fill="white" />
  </svg>,
  <svg key="3" viewBox="0 0 100 32" className="h-6 w-auto opacity-50" fill="none">
    <path d="M8 8L24 24M24 8L8 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="1.5" />
  </svg>,
  <svg key="4" viewBox="0 0 100 32" className="h-6 w-auto opacity-50" fill="none">
    <rect x="4" y="8" width="8" height="16" rx="2" fill="white" />
    <rect x="16" y="12" width="8" height="12" rx="2" fill="white" />
    <rect x="28" y="6" width="8" height="20" rx="2" fill="white" />
  </svg>,
  <svg key="5" viewBox="0 0 100 32" className="h-6 w-auto opacity-50" fill="none">
    <path d="M4 22C4 22 8 10 16 10C24 10 28 22 28 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="16" cy="20" r="3" fill="white" />
  </svg>,
];

/* ─────────────────────────────────────────────
   FAQ data
   ───────────────────────────────────────────── */

const faqItems = [
  {
    q: 'Is my data safe with Plety?',
    a: 'Absolutely. We use enterprise-grade AES-256 encryption both at rest and in transit. Your data is stored in SOC 2 Type II certified data centers, and we never use your content to train AI models. You retain full ownership and control.',
  },
  {
    q: 'How does pricing work?',
    a: 'Plety offers transparent, usage-based pricing. You only pay for what you use — no hidden fees, no long-term contracts. Our free tier includes 1,000 API calls per month so you can try everything risk-free before upgrading.',
  },
  {
    q: 'Can I integrate Plety with my existing tools?',
    a: 'Yes. Plety provides a comprehensive REST API, webhooks, and native integrations with Slack, Notion, Zapier, and GitHub. Our SDKs are available for TypeScript, Python, and Go, with more languages coming soon.',
  },
  {
    q: 'What languages does the transcription support?',
    a: 'Our transcription engine supports over 60 languages including English, Spanish, French, German, Portuguese, Japanese, Korean, and Mandarin. It automatically detects the spoken language and handles code-switching gracefully.',
  },
  {
    q: 'How fast is the API response time?',
    a: 'Our average API response time is under 200ms for chat completions and under 500ms for transcription. We maintain 99.9% uptime with automatic failover across multiple regions, ensuring your applications stay responsive.',
  },
];

/* ─────────────────────────────────────────────
   Accordion Item
   ───────────────────────────────────────────── */

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
  isLast,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div className={!isLast ? 'border-b border-white/10' : ''}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-6 text-left transition-colors hover:text-white/90"
      >
        <span className="pr-8 text-lg font-medium text-white">{question}</span>
        <span
          className={`flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          <Plus className="h-5 w-5 text-white/60" />
        </span>
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="pb-6 text-[15px] leading-relaxed text-gray-400">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────── */

export default function PletyPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const feature1VideoRef = useRef<HTMLVideoElement>(null);
  const feature2VideoRef = useRef<HTMLVideoElement>(null);
  const footerVideoRef = useRef<HTMLVideoElement>(null);

  /* ── Scroll observer ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Smooth scroll ── */
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  /* ── Close mobile menu on resize to desktop ── */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  /* ── Play videos when visible ── */
  useEffect(() => {
    const videos = [
      videoRef.current,
      feature1VideoRef.current,
      feature2VideoRef.current,
      footerVideoRef.current,
    ];
    const observers: IntersectionObserver[] = [];

    videos.forEach((v) => {
      if (!v) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        },
        { threshold: 0.3 },
      );
      obs.observe(v);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      {/* ================================================================
          Inline Styles: marquee + accordion grid
          ================================================================ */}
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .mask-fade-x {
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 12%,
            black 88%,
            transparent 100%
          );
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 12%,
            black 88%,
            transparent 100%
          );
        }
      `}</style>

      <div className="min-h-screen bg-black text-white">
        {/* ============================================================
            NAVIGATION
            ============================================================ */}
        <nav
          className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
            scrolled
              ? 'border-b border-white/5 bg-black/80 backdrop-blur-xl'
              : 'bg-transparent'
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2.5">
              <PletyLogo className="h-8 w-8" />
              <span className="text-xl font-semibold tracking-tight">Plety</span>
            </a>

            {/* Desktop links */}
            <div className="hidden items-center gap-8 md:flex">
              {['About', 'Features', 'FAQ', 'Contact'].map((label) => (
                <button
                  key={label}
                  onClick={() => scrollTo(label.toLowerCase())}
                  className="text-sm font-medium text-white/70 transition-colors hover:text-white"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden items-center gap-3 md:flex">
              <button
                onClick={() => scrollTo('contact')}
                className="rounded-full border border-white/5 bg-[#1F1F22] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2A2A2E]"
              >
                Get started
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile dropdown */}
          {mobileOpen && (
            <div className="border-t border-white/5 bg-black/95 backdrop-blur-xl md:hidden">
              <div className="flex flex-col gap-1 px-6 py-4">
                {['About', 'Features', 'FAQ', 'Contact'].map((label) => (
                  <button
                    key={label}
                    onClick={() => scrollTo(label.toLowerCase())}
                    className="rounded-lg px-4 py-3 text-left text-base font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => scrollTo('contact')}
                  className="mt-2 rounded-full border border-white/5 bg-[#1F1F22] px-5 py-2.5 text-sm font-medium text-white"
                >
                  Get started
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* ============================================================
            HERO
            ============================================================ */}
        <section
          id="about"
          className="relative flex min-h-screen items-center justify-center overflow-hidden pt-32 pb-20"
        >
          {/* Background video */}
          <video
            ref={videoRef}
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-90"
            src="https://cdn.sceneai.art/Hero%20Section%20Video/50b4f304-cdca-4e12-8735-580d225834be.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/50 to-black" />

          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <FadeInUp>
              {/* Badge */}
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                Announcing API 2.0
              </div>
            </FadeInUp>

            <FadeInUp delay={0.1}>
              <h1 className="mb-6 text-5xl leading-tight font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                The intelligence layer
                <br />
                for clear{' '}
                <span className="font-serif italic font-normal">decisions.</span>
              </h1>
            </FadeInUp>

            <FadeInUp delay={0.2}>
              <p className="mx-auto mb-10 max-w-2xl text-[16px] leading-relaxed text-gray-400">
                Plety combines advanced AI models with intuitive interfaces to
                help teams move faster, communicate better, and make data-driven
                decisions — without the complexity.
              </p>
            </FadeInUp>

            <FadeInUp delay={0.3}>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  onClick={() => scrollTo('contact')}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollTo('features')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1F1F22] px-7 py-3 text-sm font-medium text-white transition-all hover:bg-[#2A2A2E]"
                >
                  View features
                </button>
              </div>
            </FadeInUp>

            {/* Marquee */}
            <FadeInUp delay={0.5}>
              <p className="mb-6 mt-20 text-xs font-medium uppercase tracking-widest text-white/30">
                Trusted by industry leaders
              </p>
              <div className="mask-fade-x overflow-hidden">
                <div className="animate-marquee flex w-max items-center gap-0">
                  {[...brandLogos, ...brandLogos, ...brandLogos].map(
                    (logo, i) => (
                      <div key={i} className="flex-shrink-0 px-8">
                        {logo}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ============================================================
            FEATURE 1 — AI Chat
            ============================================================ */}
        <section id="features" className="relative py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
            {/* Text */}
            <FadeInUp>
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                  <Sparkles className="h-3 w-3" />
                  AI Chat
                </span>
                <h2 className="mb-5 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                  Where speed meets intelligent conversation.
                </h2>
                <p className="mb-8 text-[16px] leading-relaxed text-gray-400">
                  Our AI chat engine delivers instant, context-aware responses
                  powered by the latest language models. From casual conversation
                  to deep technical research — Plety adapts to your needs in real time.
                </p>
                <button
                  onClick={() => scrollTo('contact')}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200"
                >
                  Get started
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </FadeInUp>

            {/* Mockup */}
            <FadeInUp delay={0.2}>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8">
                {/* Background video */}
                <video
                  ref={feature1VideoRef}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  src="https://cdn.sceneai.art/Hero%20Section%20Video/1bcc8fa3-37f6-4c53-8591-0347e4c7f8ac.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-0 bg-black/20" />

                {/* Floating UI card */}
                <div className="relative z-10 space-y-4">
                  {/* Chips */}
                  <div className="flex flex-wrap gap-2">
                    {['Create image', 'Write code', 'Summarize', 'Translate'].map(
                      (chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md"
                        >
                          {chip}
                        </span>
                      ),
                    )}
                  </div>

                  {/* Chat bubble */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                        <MessageSquare className="h-4 w-4 text-white/70" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm leading-relaxed text-white/80">
                          Here is a summary of the quarterly report highlighting
                          key growth metrics across all regions.
                        </p>
                        <p className="text-xs text-white/40">Just now</p>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-md">
                    <input
                      readOnly
                      className="flex-1 bg-transparent text-sm text-white/50 outline-none"
                      value="Ask anything..."
                    />
                    <Mic className="h-4 w-4 text-white/40" />
                    <ArrowRight className="h-4 w-4 text-white/60" />
                  </div>
                </div>
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ============================================================
            FEATURE 2 — AI Transcription
            ============================================================ */}
        <section className="relative py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
            {/* Mockup */}
            <FadeInUp>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 lg:order-first">
                {/* Background video */}
                <video
                  ref={feature2VideoRef}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  src="https://cdn.sceneai.art/Hero%20Section%20Video/736fd4a0-70ac-4f44-9633-55769ead6aca.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-0 bg-black/20" />

                {/* Floating card */}
                <div className="relative z-10 space-y-5">
                  {/* Play button + timestamp */}
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                      <Play className="ml-0.5 h-5 w-5 text-white" fill="white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">11:06 AM – Chris</p>
                      <p className="text-xs text-white/40">Team standup · 12 min</p>
                    </div>
                  </div>

                  {/* Waveform visualization */}
                  <div className="flex items-end gap-0.5 h-10">
                    {Array.from({ length: 36 }).map((_, i) => {
                      const h = Math.sin(i * 0.6) * 30 + 35 + Math.random() * 15;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-full bg-white/30 backdrop-blur-md"
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>

                  {/* Transcription text */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                    <p className="text-sm leading-relaxed text-white/80">
                      Alright team, let us go over the Q3 priorities. First, we need
                      to finalize the API v2 migration plan by Friday...
                    </p>
                  </div>
                </div>
              </div>
            </FadeInUp>

            {/* Text */}
            <FadeInUp delay={0.2}>
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-400/10 px-3 py-1 text-xs font-semibold text-green-400">
                  <FileText className="h-3 w-3" />
                  AI Transcription
                </span>
                <h2 className="mb-5 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                  Turn speech into text with speed and precision.
                </h2>
                <p className="mb-8 text-[16px] leading-relaxed text-gray-400">
                  Transcribe meetings, interviews, and voice notes in real time
                  with industry-leading accuracy. Plety handles multiple speakers,
                  accents, and languages — all with a single, streamlined API.
                </p>
                <button
                  onClick={() => scrollTo('contact')}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200"
                >
                  Get started
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ============================================================
            FAQ
            ============================================================ */}
        <section id="faq" className="py-32">
          <div className="mx-auto max-w-3xl px-6">
            <FadeInUp>
              <h2 className="mb-12 text-center text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                We&apos;ve got answers
              </h2>
            </FadeInUp>

            <FadeInUp delay={0.1}>
              <div className="rounded-xl border border-white/10 bg-transparent">
                {faqItems.map((item, i) => (
                  <AccordionItem
                    key={i}
                    question={item.q}
                    answer={item.a}
                    isOpen={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                    isLast={i === faqItems.length - 1}
                  />
                ))}
              </div>
            </FadeInUp>
          </div>
        </section>

        {/* ============================================================
            FOOTER
            ============================================================ */}
        <footer id="contact" className="relative overflow-hidden">
          {/* Background video */}
          <video
            ref={footerVideoRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
            src="https://cdn.sceneai.art/Hero%20Section%20Video/50b4f304-cdca-4e12-8735-580d225834be.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          {/* Strong gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/60" />

          <div className="relative z-10">
            {/* CTA */}
            <div className="px-6 py-32 text-center">
              <FadeInUp>
                <h2 className="mb-6 text-5xl leading-tight font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                  Ready to automate{' '}
                  <span className="font-serif italic font-normal">everything?</span>
                </h2>
              </FadeInUp>

              <FadeInUp delay={0.15}>
                <p className="mx-auto mb-10 max-w-xl text-[16px] leading-relaxed text-gray-400">
                  Join thousands of teams already using Plety to streamline
                  their workflows and unlock new levels of productivity.
                </p>
              </FadeInUp>

              <FadeInUp delay={0.3}>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200">
                    Get started free
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1F1F22] px-7 py-3 text-sm font-medium text-white transition-all hover:bg-[#2A2A2E]">
                    Talk to sales
                  </button>
                </div>
              </FadeInUp>
            </div>

            {/* Link grid */}
            <div className="mx-auto mb-16 grid max-w-7xl gap-12 px-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Brand */}
              <div>
                <a href="#" className="mb-4 flex items-center gap-2.5">
                  <PletyLogo className="h-7 w-7" />
                  <span className="text-lg font-semibold">Plety</span>
                </a>
                <p className="text-sm leading-relaxed text-gray-400">
                  The intelligence layer for modern teams. Make faster, smarter
                  decisions with AI that works the way you do.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-white">Product</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  {['AI Chat', 'Transcription', 'API Docs', 'Pricing', 'Changelog'].map(
                    (link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="transition-colors hover:text-white"
                        >
                          {link}
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-white">Legal</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  {['Privacy Policy', 'Terms of Service', 'GDPR', 'Security'].map(
                    (link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="transition-colors hover:text-white"
                        >
                          {link}
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Social */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-white">Social</h4>
                <div className="flex gap-4">
                  {/* X (Twitter) */}
                  <a
                    href="#"
                    aria-label="X (Twitter)"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-all hover:border-white/20 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  {/* LinkedIn */}
                  <a
                    href="#"
                    aria-label="LinkedIn"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-all hover:border-white/20 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  {/* GitHub */}
                  <a
                    href="#"
                    aria-label="GitHub"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-all hover:border-white/20 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-white/5 px-6 py-6 text-center text-sm text-gray-500">
              © 2026 Plety. All rights reserved · by{' '}
              <span className="text-gray-300">Re-text</span> · Made in{' '}
              <span className="text-gray-300">Gemini</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
