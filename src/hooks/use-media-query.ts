import { useEffect, useState } from "react";

// Hook reactivo a media queries (no había ninguno en el repo). SSR-safe: arranca en false
// y se sincroniza en el primer efecto del cliente.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Desktop/tablet = breakpoint `md` de Tailwind (768px). Mantener en sync con tailwind.config.
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
