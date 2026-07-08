'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Menu,
  X,
  Plus,
  ChevronDown,
  Play,
  Camera,
  Video,
  Building2,
  ArrowRight,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  SVG Logo — Plety minimal geometric stroke logo                            */
/* -------------------------------------------------------------------------- */

function PletyLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 28"
      fill="none"
      className={className}
      aria-label="Plety"
    >
      {/* Geometric mark: interconnected hex nodes */}
      <rect
        x="2"
        y="6"
        width="16"
        height="16"
        rx="4"
        stroke="white"
        strokeWidth="1.5"
      />
      <circle cx="14" cy="14" r="3" fill="white" />
      <line
        x1="20"
        y1="14"
        x2="28"
        y2="14"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="14" r="3" stroke="white" strokeWidth="1.5" />
      {/* Wordmark */}
      <text
        x="40"
        y="20"
        fill="white"
        fontSize="17"
        fontWeight="500"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.3"
      >
        Plety
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ Data                                                                  */
/* -------------------------------------------------------------------------- */

const FAQ_ITEMS = [
  {
    q: 'What is Plety?',
    a: 'Plety is an AI-native automation platform that transcribes, analyzes, and acts on your calls and meetings in real-time. Think of it as your always-on operations assistant.',
  },
  {
    q: 'How does AI transcription work?',
    a: 'Our models process audio with < 300ms latency, converting speech to structured text. Speaker diarization, punctuation, and formatting happen automatically. You get searchable, shareable transcripts instantly.',
  },
  {
    q: 'Can Plety integrate with my existing tools?',
    a: 'Absolutely. We ship native integrations with Slack, Notion, Google Drive, Salesforce, and 50+ other platforms. Our API also supports custom webhooks and Zapier/Make connectors.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are SOC 2 Type II certified. You control retention policies and can delete data at any time. We never train on your data.',
  },
  {
    q: 'What does pricing look like?',
    a: 'We offer a free tier with 5 hours/month of transcription. Pro starts at $29/month for unlimited transcription and integrations. Enterprise plans include SSO, audit logs, and dedicated support. See our pricing page for full details.',
  },
];

/* -------------------------------------------------------------------------- */
/*  FadeInUp Animation Wrapper                                                */
/* -------------------------------------------------------------------------- */

function FadeInUp({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 1, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Navigation Links Data                                                     */
/* -------------------------------------------------------------------------- */

const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Features', href: '#features' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

/* -------------------------------------------------------------------------- */
/*  Main Page Component                                                       */
/* -------------------------------------------------------------------------- */

export default function PletyLandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const feat1VideoRef = useRef<HTMLVideoElement>(null);
  const feat2VideoRef = useRef<HTMLVideoElement>(null);

  const aboutRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const faqRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  /* ---- Scroll tracking for nav style ---- */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ---- Smooth scroll to section ---- */
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileOpen(false);
  }, []);

  /* ---- Video autoplay based on visibility ---- */
  useEffect(() => {
    const videos = [heroVideoRef.current, feat1VideoRef.current, feat2VideoRef.current];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.2 },
    );

    for (const video of videos) {
      if (video) observer.observe(video);
    }
    return () => observer.disconnect();
  }, []);

  /* ---- Toggle FAQ ---- */
  const toggleFaq = (idx: number) => {
    setActiveFaq((prev) => (prev === idx ? null : idx));
  };

  return (
    <>
      {/* ================================================================== */}
      {/*  Navigation                                                         */}
      {/* ================================================================== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>
            <PletyLogo className="h-7 w-auto" />
          </a>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(link.href.slice(1));
                }}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                scrollTo('contact');
              }}
              className="rounded-full border border-white/5 bg-[#1F1F22] px-5 py-2 text-sm text-white transition-colors hover:bg-[#2A2A2E]"
            >
              Get started
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-white"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${
            mobileOpen ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <div className="flex flex-col gap-2 border-t border-white/5 bg-black/90 px-6 pb-6 pt-4 backdrop-blur-xl">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(link.href.slice(1));
                }}
                className="py-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                scrollTo('contact');
              }}
              className="mt-2 inline-block rounded-full border border-white/5 bg-[#1F1F22] px-5 py-2 text-center text-sm text-white"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* ================================================================== */}
      {/*  Hero Section (id="about") — Foldcraft Creative Studio              */}
      {/* ================================================================== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
        .font-geist { font-family: 'Geist', sans-serif; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section
        ref={aboutRef}
        id="about"
        className="relative h-screen w-full overflow-hidden bg-black font-geist"
      >
        {/* Background video */}
        <video
          ref={heroVideoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={{ objectPosition: '70% center' }}
        />

        {/* Hero Navbar (visual only, z-30) */}
        <div className="relative z-30 flex w-full items-center justify-between px-6 py-5 md:px-12 lg:px-16">
          {/* Left: logo + desktop nav links */}
          <div className="flex items-center">
            <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Foldcraft
            </span>
            <div className="ml-8 hidden gap-8 md:flex">
              {['Home', 'Projects', 'Studio', 'Reach Us'].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-sm text-white/80 transition-colors hover:text-white"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* Right desktop: CTA button */}
          <div className="hidden items-center md:flex">
            <button className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-105">
              Let&apos;s Talk
            </button>
          </div>

          {/* Right mobile: hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative z-50 flex h-10 w-10 items-center justify-center transition-transform active:scale-90 md:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {/* Menu icon */}
            <Menu
              size={24}
              className={`absolute text-white transition-all duration-300 ${
                mobileMenuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'
              }`}
            />
            {/* X icon */}
            <X
              size={24}
              className={`absolute text-white transition-all duration-300 ${
                mobileMenuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'
              }`}
            />
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`absolute inset-x-0 top-0 z-20 bg-black/98 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobileMenuOpen
              ? 'pointer-events-auto h-screen opacity-100'
              : 'pointer-events-none h-0 opacity-0'
          }`}
        >
          <div
            className={`flex h-full flex-col justify-center px-8 ${
              mobileMenuOpen ? 'animate-[fadeSlideUp_0.5s_ease_0.1s_both]' : ''
            }`}
          >
            {['Home', 'Projects', 'Studio', 'Reach Us'].map((link) => (
              <a
                key={link}
                href="#"
                onClick={() => setMobileMenuOpen(false)}
                className="py-3 text-3xl font-medium text-white/90 hover:text-white"
              >
                {link}
              </a>
            ))}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="mt-6 rounded-full bg-white px-8 py-3.5 text-base font-medium text-black"
            >
              Let&apos;s Talk
            </button>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex h-[calc(100vh-80px)] flex-col justify-between px-6 pb-10 pt-12 sm:pb-12 sm:pt-16 md:px-12 md:pb-16 md:pt-20 lg:px-16">
          {/* Top */}
          <div>
            <p className="mb-4 animate-[fadeSlideUp_0.8s_ease_0.2s_both] text-xs text-white/90 sm:mb-6 sm:text-sm">
              Brand &amp; Visual Storytelling
            </p>
            <h1 className="max-w-3xl animate-[fadeSlideUp_0.8s_ease_0.4s_both] text-3xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Shaping visual <br />
              narratives, <br />
              one pixel at a time.
            </h1>
          </div>

          {/* Bottom */}
          <div>
            <p className="mb-5 max-w-sm animate-[fadeSlideUp_0.8s_ease_0.7s_both] text-sm leading-relaxed text-white/60 sm:mb-6 sm:max-w-lg sm:text-base md:text-lg">
              Turning vision into reality through craft, motion, and an endless pursuit of beauty.
            </p>
            <button className="inline-flex animate-[fadeSlideUp_0.8s_ease_0.9s_both] items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform hover:scale-105 sm:px-6 sm:py-3">
              Explore Work
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  Feature 1: AI Chat (id="features")                                 */}
      {/* ================================================================== */}
      <section
        ref={featuresRef}
        id="features"
        className="mx-auto max-w-7xl px-6 py-24"
      >
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left text */}
          <FadeInUp>
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/5 px-3 py-1 text-xs font-medium text-yellow-400">
                ✨ AI chat
              </span>
              <h2 className="text-3xl font-medium tracking-tight text-white md:text-4xl">
                Chat with your transcripts in real-time
              </h2>
              <p className="text-[16px] leading-relaxed text-gray-400">
                Ask questions, extract action items, and get summaries — all
                through a natural conversation with your meeting data. Plety
                understands context across multiple sessions.
              </p>
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('contact');
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-[#1F1F22] px-6 py-2.5 text-sm text-white transition-colors hover:bg-[#2A2A2E]"
              >
                Get started
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </a>
            </div>
          </FadeInUp>

          {/* Right mockup */}
          <FadeInUp delay={0.15}>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8">
              {/* Background video */}
              <video
                ref={feat1VideoRef}
                src="https://cdn.sceneai.art/Hero%20Section%20Video/1bcc8fa3-37f6-4c53-8591-0347e4c7f8ac.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />

              {/* Floating card */}
              <div className="relative z-10 mt-16 rounded-2xl border border-white/10 bg-[#1C1C1E]/90 p-4 backdrop-blur-xl">
                {/* Chips row */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                    Summary
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                    Action items
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                    Key decisions
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/60">
                  Here are the 3 action items from your last sync: finalize Q3
                  roadmap by Friday, schedule 1:1s with the engineering leads,
                  and review the pricing proposal...
                </p>
                {/* Input bar */}
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-white/30">Ask a follow-up...</span>
                  <div className="ml-auto h-2 w-2 rounded-full bg-green-400" />
                </div>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  Feature 2: AI Transcription (reversed columns)                     */}
      {/* ================================================================== */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left mockup (reversed — appears first on desktop) */}
          <FadeInUp className="lg:order-1">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8">
              {/* Background video */}
              <video
                ref={feat2VideoRef}
                src="https://cdn.sceneai.art/Hero%20Section%20Video/736fd4a0-70ac-4f44-9633-55769ead6aca.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />

              {/* Card */}
              <div className="relative z-10 mt-16 rounded-2xl border border-white/10 bg-[#1C1C1E]/90 p-4 backdrop-blur-xl">
                {/* Header row */}
                <div className="mb-3 flex items-center gap-3">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                    <Play size={14} className="ml-0.5 text-black" fill="black" />
                  </button>
                  <div>
                    <p className="text-xs font-medium text-white">
                      11:06 AM – Chris
                    </p>
                    <p className="text-[10px] text-white/40">Sales call · 32 min</p>
                  </div>
                </div>

                {/* Waveform bars */}
                <div className="mb-3 flex items-end gap-[2px] h-8">
                  {[4, 8, 6, 12, 5, 10, 7, 14, 6, 11, 8, 9, 5, 13, 7, 10, 6, 8, 4, 11].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-green-400/60"
                        style={{ height: `${h}px` }}
                      />
                    ),
                  )}
                </div>

                {/* Transcription text */}
                <p className="text-xs leading-relaxed text-white/50">
                  Yeah, I think the Q3 numbers are looking solid. We should
                  probably loop in the design team before we commit to the
                  new onboarding flow though...
                </p>
              </div>
            </div>
          </FadeInUp>

          {/* Right text */}
          <FadeInUp delay={0.15} className="lg:order-2">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1 text-xs font-medium text-green-400">
                ✨ AI transcription
              </span>
              <h2 className="text-3xl font-medium tracking-tight text-white md:text-4xl">
                Real-time transcription with speaker labels
              </h2>
              <p className="text-[16px] leading-relaxed text-gray-400">
                Every word captured with sub-300ms latency. Speaker diarization
                tells you who said what. Search across thousands of hours of
                calls in seconds. Export to Notion, Slack, or your CRM.
              </p>
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('contact');
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-[#1F1F22] px-6 py-2.5 text-sm text-white transition-colors hover:bg-[#2A2A2E]"
              >
                Get started
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </a>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  FAQ Section (id="faq")                                             */}
      {/* ================================================================== */}
      <section ref={faqRef} id="faq" className="mx-auto max-w-3xl px-6 py-32">
        <FadeInUp>
          <h2 className="mb-12 text-center text-3xl font-medium tracking-tight text-white md:text-4xl">
            We&apos;ve got answers
          </h2>
        </FadeInUp>

        <FadeInUp delay={0.1}>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-transparent">
            {FAQ_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className={idx < FAQ_ITEMS.length - 1 ? 'border-b border-white/10' : ''}
              >
                {/* Question button */}
                <button
                  onClick={() => toggleFaq(idx)}
                  className="flex w-full items-center justify-between px-6 py-6 text-left"
                >
                  <span className="pr-4 text-sm font-medium text-white">
                    {item.q}
                  </span>
                  <span className="flex-shrink-0 text-white/50 transition-transform duration-300"
                    style={{ transform: activeFaq === idx ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                    <Plus size={18} />
                  </span>
                </button>

                {/* Answer — CSS grid height animation trick */}
                <div
                  className="accordion-content px-6"
                  style={{
                    display: 'grid',
                    gridTemplateRows: activeFaq === idx ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s ease',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <p className="pb-6 text-sm text-gray-400">{item.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeInUp>
      </section>

      {/* ================================================================== */}
      {/*  Footer (id="contact")                                              */}
      {/* ================================================================== */}
      <footer ref={contactRef} id="contact" className="relative overflow-hidden border-t border-white/5 pt-32 pb-10">
        {/* Background video (same as hero, lower opacity, stronger gradient) */}
        <video
          src="https://cdn.sceneai.art/Hero%20Section%20Video/50b4f304-cdca-4e12-8735-580d225834be.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 -z-10 min-h-full min-w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-black/60 to-black" />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          {/* CTA */}
          <FadeInUp>
            <div className="mb-32 text-center">
              <h2 className="text-4xl font-medium tracking-tight text-white md:text-5xl">
                Ready to automate <span className="font-serif italic font-normal">everything?</span>
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="#"
                  className="rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  Start free trial
                </a>
                <a
                  href="#features"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo('features');
                  }}
                  className="rounded-full border border-white/5 bg-[#1F1F22] px-7 py-3 text-sm text-white transition-colors hover:bg-[#2A2A2E]"
                >
                  See how it works
                </a>
              </div>
            </div>
          </FadeInUp>

          {/* Link grid */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Col 1: Logo + tagline */}
            <div className="space-y-3">
              <PletyLogo className="h-7 w-auto" />
              <p className="text-sm text-gray-400">
                Speed, scale, and smarts — deployed.
              </p>
            </div>

            {/* Col 2: Product */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Product
              </h4>
              <ul className="space-y-2">
                {['About', 'Pricing', 'Changelog', 'Contact'].map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Legal */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Legal
              </h4>
              <ul className="space-y-2">
                {['Terms of service', 'Privacy policy', '404'].map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Social */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Social
              </h4>
              <ul className="space-y-2">
                {[
                  { label: 'Instagram', Icon: Camera },
                  { label: 'YouTube', Icon: Video },
                  { label: 'LinkedIn', Icon: Building2 },
                  { label: 'Twitter / X', Icon: X },
                ].map(({ label, Icon }) => (
                  <li key={label}>
                    <a
                      href="#"
                      className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-16 border-t border-white/5 pt-6 text-center text-xs text-gray-500">
            <p>
              © 2026 Plety. All rights reserved · by{' '}
              <span className="text-gray-300">Re-text</span> · Made in{' '}
              <span className="text-gray-300">Gemini</span>
            </p>
          </div>
        </div>
      </footer>

    </>
  );
}
