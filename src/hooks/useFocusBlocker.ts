import { useState, useEffect, useCallback } from "react";

interface BlockedSite {
  id: string;
  domain: string;
}

interface UseFocusBlockerProps {
  isActive: boolean;
  blockedSites: BlockedSite[];
  currentUrl: string;
}

export function useFocusBlocker({ isActive, blockedSites, currentUrl }: UseFocusBlockerProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedDomain, setBlockedDomain] = useState<string | null>(null);

  const checkIfBlocked = useCallback(
    (url: string): boolean => {
      if (!isActive || blockedSites.length === 0) return false;

      try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        return blockedSites.some((site) => {
          const blocked = site.domain.replace(/^www\./, "");
          return hostname === blocked || hostname.endsWith(`.${blocked}`);
        });
      } catch {
        return false;
      }
    },
    [isActive, blockedSites]
  );

  useEffect(() => {
    if (!currentUrl) {
      setIsBlocked(false);
      setBlockedDomain(null);
      return;
    }

    const blocked = checkIfBlocked(currentUrl);
    setIsBlocked(blocked);

    if (blocked) {
      try {
        const hostname = new URL(currentUrl).hostname.replace(/^www\./, "");
        setBlockedDomain(hostname);
      } catch {
        setBlockedDomain(currentUrl);
      }
    } else {
      setBlockedDomain(null);
    }
  }, [currentUrl, checkIfBlocked]);

  return { isBlocked, blockedDomain, checkIfBlocked };
}