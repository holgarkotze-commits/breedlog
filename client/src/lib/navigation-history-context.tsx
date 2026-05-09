import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { NavigationHistory } from "./navigation-history";

interface NavHistoryCtx {
  goBack: (fallback?: string) => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  previousPath: string | undefined;
}

const NavHistoryContext = createContext<NavHistoryCtx>({
  goBack: () => window.history.back(),
  goForward: () => {},
  canGoBack: false,
  canGoForward: false,
  previousPath: undefined,
});

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  const historyRef = useRef(new NavigationHistory(location));
  const isProgrammaticRef = useRef(false);
  const isNativePopstateRef = useRef(false);

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [previousPath, setPreviousPath] = useState<string | undefined>(undefined);

  const syncState = useCallback(() => {
    const h = historyRef.current;
    setCanGoBack(h.canGoBack);
    setCanGoForward(h.canGoForward);
    setPreviousPath(h.previous);
  }, []);

  useEffect(() => {
    const handlePopstate = () => {
      isNativePopstateRef.current = true;
    };
    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, []);

  useEffect(() => {
    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      return;
    }

    if (isNativePopstateRef.current) {
      isNativePopstateRef.current = false;
      historyRef.current.syncNativeBack(location);
      syncState();
      return;
    }

    historyRef.current.push(location);
    syncState();
  }, [location, syncState]);

  const goBack = useCallback(
    (fallback = "/animals") => {
      const h = historyRef.current;
      if (h.canGoBack) {
        h.back(fallback);
        syncState();
        isProgrammaticRef.current = true;
        window.history.back();
      } else {
        navigate(fallback);
      }
    },
    [navigate, syncState]
  );

  const goForward = useCallback(() => {
    const h = historyRef.current;
    if (h.canGoForward) {
      h.forward();
      syncState();
      isProgrammaticRef.current = true;
      window.history.forward();
    }
  }, [syncState]);

  return (
    <NavHistoryContext.Provider
      value={{ goBack, goForward, canGoBack, canGoForward, previousPath }}
    >
      {children}
    </NavHistoryContext.Provider>
  );
}

export function useNavigationHistory(): NavHistoryCtx {
  return useContext(NavHistoryContext);
}
