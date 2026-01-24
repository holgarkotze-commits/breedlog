import { useState, useEffect } from "react";

export interface RecentVisit {
  path: string;
  label: string;
  timestamp: number;
}

const STORAGE_KEY = "breedlog_recent_visits";
const MAX_VISITS = 10;

export function useRecentVisits() {
  const [visits, setVisits] = useState<RecentVisit[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setVisits(JSON.parse(stored));
      } catch {
        setVisits([]);
      }
    }
  }, []);

  const addVisit = (path: string, label: string) => {
    if (path === "/") return;
    
    const newVisit: RecentVisit = {
      path,
      label,
      timestamp: Date.now(),
    };

    setVisits((prev) => {
      const filtered = prev.filter((v) => v.path !== path);
      const updated = [newVisit, ...filtered].slice(0, MAX_VISITS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const getRecentVisits = (count: number = 4): RecentVisit[] => {
    return visits.slice(0, count);
  };

  return { visits, addVisit, getRecentVisits };
}
