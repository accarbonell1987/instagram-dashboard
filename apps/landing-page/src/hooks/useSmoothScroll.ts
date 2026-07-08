import { NAV_HEIGHT } from "@/lib/constants";

export function useSmoothScroll() {
  const scrollTo = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    const top =
      element.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${sectionId}`);
  };

  return { scrollTo };
}
