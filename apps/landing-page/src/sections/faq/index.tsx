"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@core/ui";
import { SectionHead } from "@/components/ui/SectionHead";
import { AnimatedSection } from "@/components/layout";

export function Faq() {
  const t = useTranslations("faq");

  const faqItems = [
    { id: "q1", question: t("q1"), answer: t("a1") },
    { id: "q2", question: t("q2"), answer: t("a2") },
    { id: "q3", question: t("q3"), answer: t("a3") },
    { id: "q4", question: t("q4"), answer: t("a4") },
    { id: "q5", question: t("q5"), answer: t("a5") },
  ];

  return (
    <section id="faq" className="sec-faq py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t("eyebrow")}
            heading={
              <>
                {t("heading1")}
                <br />
                {t("heading2")}
              </>
            }
            align="center"
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-10 max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="flex flex-col gap-3">
            {faqItems.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border border-border-default rounded-card overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 bg-surface hover:bg-surface-hi hover:no-underline font-display font-semibold text-text-default text-sm leading-snug">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pt-3 pb-5 text-text-dim text-sm leading-relaxed border-t border-border-default">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedSection>
      </div>
    </section>
  );
}
