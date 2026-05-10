/**
 * Local deterministic fallback for BreedLog AI Assistant.
 *
 * When the Gemini provider quota is exhausted or the provider is unavailable,
 * this module computes a factual, record-based answer directly from the
 * BreedLogAIContext — no external API call required.
 *
 * All answers are derived exclusively from the user's own BreedLog records.
 * No numbers are fabricated or estimated; if data is absent the answer says so.
 */

import type { BreedLogAIContext } from "./breedlog-ai-context";

export interface LocalFallbackResult {
  answer: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  usedData: string[];
  warnings: string[];
  suggestedNextQuestions: string[];
  isFallback: true;
}

function fmt(v: number | null | undefined, suffix = "", digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v as number)) return "—";
  return `${(v as number).toFixed(digits)}${suffix}`;
}

// ─── Section handlers ────────────────────────────────────────────────────────

function herdOverview(ctx: BreedLogAIContext): LocalFallbackResult {
  const h = ctx.herd;
  const farm = ctx.workspace.farmName ? `${ctx.workspace.farmName} has` : "Your herd has";
  const lines: string[] = [
    `${farm} ${h.total} animal${h.total === 1 ? "" : "s"} total.`,
    `Active: ${h.active}  |  Culled: ${h.culled}`,
    `Adults — Rams: ${h.rams}, Ewes: ${h.ewes}`,
    `Lambs (≤365 days old): ${h.lambs}`,
    `Classification — Stud: ${h.stud}, Commercial: ${h.commercial}, Unclassified: ${h.unclassified}`,
  ];
  if (ctx.workspace.dataQualityScore > 0) {
    lines.push(`\nData quality: ${ctx.workspace.dataQualityScore.toFixed(0)}%`);
  }
  const warnings: string[] = [];
  if (h.total === 0) warnings.push("No animals recorded yet. Add animals to get herd insights.");
  return {
    answer: lines.join("\n"),
    confidence: h.total >= 10 ? "high" : h.total > 0 ? "medium" : "insufficient",
    usedData: ["herd distribution", "animal statuses", "classification breakdown"],
    warnings,
    suggestedNextQuestions: [
      "Which ram is performing best?",
      "What needs my attention first?",
      "How complete is my herd data?",
    ],
    isFallback: true,
  };
}

function dataQuality(ctx: BreedLogAIContext): LocalFallbackResult {
  const score = ctx.workspace.dataQualityScore;
  const m = ctx.missingData;
  const lines: string[] = [
    `Data quality score: ${score.toFixed(0)}% across ${ctx.herd.total} animal${ctx.herd.total === 1 ? "" : "s"}.`,
  ];
  if (score >= 80) lines.push("Your records are in good shape.");
  else if (score >= 50) lines.push("Fair records — some gaps are worth filling to improve analytics.");
  else lines.push("Significant gaps in records will limit analytics accuracy.");

  const gaps: string[] = [];
  if (m.noBirthDate > 0) gaps.push(`${m.noBirthDate} animal(s) missing birth date`);
  if (m.noBirthWeight > 0) gaps.push(`${m.noBirthWeight} animal(s) missing birth weight`);
  if (m.noWeaningWeight > 0) gaps.push(`${m.noWeaningWeight} animal(s) missing weaning weight`);
  if (m.noSireLink > 0) gaps.push(`${m.noSireLink} animal(s) missing sire link`);
  if (m.noDamLink > 0) gaps.push(`${m.noDamLink} animal(s) missing dam link`);

  if (gaps.length > 0) {
    lines.push(`\nField gaps:\n• ${gaps.join("\n• ")}`);
  } else if (ctx.herd.total > 0) {
    lines.push("\nNo critical field gaps detected.");
  }

  return {
    answer: lines.join("\n"),
    confidence: "high",
    usedData: ["animal records", "field completeness audit"],
    warnings: [...ctx.workspace.dataQualityWarnings].slice(0, 5),
    suggestedNextQuestions: [
      "What needs my attention first?",
      "What's my herd summary?",
      "How many animals have no sire linked?",
    ],
    isFallback: true,
  };
}

function sirePerformance(ctx: BreedLogAIContext): LocalFallbackResult {
  const sires = ctx.sires;
  if (sires.length === 0) {
    return {
      answer:
        "No sire-linked progeny found. Link animals to their sires (sireId field) to unlock sire performance rankings.",
      confidence: "insufficient",
      usedData: ["sire linkage records"],
      warnings: ["Link offspring to sires to enable this section."],
      suggestedNextQuestions: ["What's my herd summary?", "What needs my attention first?"],
      isFallback: true,
    };
  }
  const lines: string[] = [`${sires.length} sire(s) with linked progeny:\n`];
  sires.slice(0, 8).forEach((s, i) => {
    const bw = s.avgBirthWeight !== null ? `Birth: ${fmt(s.avgBirthWeight, " kg")}` : "";
    const ww = s.avgWeaningWeight !== null ? `Weaning: ${fmt(s.avgWeaningWeight, " kg")}` : "";
    const weights = [bw, ww].filter(Boolean).join(", ");
    lines.push(`${i + 1}. ${s.tag} — ${s.offspring} progeny${weights ? `  |  ${weights}` : ""}`);
  });
  const best = sires[0];
  lines.push(`\nTop sire by progeny count: ${best.tag} (${best.offspring} recorded offspring).`);
  if (best.avgWeaningWeight !== null) {
    lines.push(`Top sire avg weaning weight: ${fmt(best.avgWeaningWeight, " kg")}`);
  }

  return {
    answer: lines.join("\n"),
    confidence: sires[0].offspring >= 5 ? "high" : "medium",
    usedData: ["sire-offspring linkage", "birth weights", "weaning weights"],
    warnings:
      sires.length < 2
        ? ["Only one sire with linked records — more data needed for reliable comparison."]
        : [],
    suggestedNextQuestions: [
      "Which ewes are performing best?",
      "What are my lamb growth averages?",
      "What needs my attention first?",
    ],
    isFallback: true,
  };
}

function ewePerformance(ctx: BreedLogAIContext): LocalFallbackResult {
  const e = ctx.ewes;
  if (e.active === 0) {
    return {
      answer: "No active ewes found in your records.",
      confidence: "insufficient",
      usedData: ["ewe records"],
      warnings: [],
      suggestedNextQuestions: ["What's my overall herd summary?"],
      isFallback: true,
    };
  }
  const lines: string[] = [
    `Active ewes: ${e.active}`,
    `Ewes with lambing records: ${e.lambed}`,
    `Barren (no lambs recorded): ${e.barren}`,
    `Twin-bearing ewes: ${e.twinBearing}`,
  ];
  if (e.topPerformers.length > 0) {
    lines.push(`\nTop performers:`);
    e.topPerformers.slice(0, 5).forEach((p, i) => {
      lines.push(`${i + 1}. ${p.tag} — ${p.lambCount} lambs, ${(p.twinRate * 100).toFixed(0)}% twin rate`);
    });
  }
  if (e.watchlist.length > 0) {
    lines.push(`\nWatchlist (low weaning rate):`);
    e.watchlist.slice(0, 3).forEach((w) => {
      lines.push(`• ${w.tag} — ${w.lambCount} lambs, ${w.weaningRate.toFixed(0)}% weaning rate`);
    });
  }
  return {
    answer: lines.join("\n"),
    confidence: e.lambed > 0 ? "high" : "medium",
    usedData: ["ewe records", "dam-offspring linkage", "weaning records"],
    warnings: e.barren > 0 ? [`${e.barren} ewe(s) have no recorded lambs.`] : [],
    suggestedNextQuestions: [
      "Which sires are performing best?",
      "What are my lamb growth averages?",
      "What needs my attention first?",
    ],
    isFallback: true,
  };
}

function lambGrowth(ctx: BreedLogAIContext): LocalFallbackResult {
  const g = ctx.lambGrowth;
  if (g.count === 0) {
    return {
      answer:
        "No lambs with weight records found. Record birth weights and weaning weights to unlock growth performance analysis.",
      confidence: "insufficient",
      usedData: ["lamb weight records"],
      warnings: ["Add birth and weaning weights to enable growth performance analysis."],
      suggestedNextQuestions: ["What's my herd summary?", "What needs my attention first?"],
      isFallback: true,
    };
  }
  const lines: string[] = [
    `Lambs with records: ${g.count} (${g.singleCount} singles, ${g.twinCount} twins)`,
    `Average birth weight: ${fmt(g.avgBirthWeight, " kg")}`,
    `Average weaning weight (100-day): ${fmt(g.avgWeaningWeight, " kg")}`,
    `Average daily gain (ADG): ${fmt(g.avgADG, " kg/day", 3)}`,
  ];
  return {
    answer: lines.join("\n"),
    confidence: g.count >= 10 ? "high" : g.count >= 3 ? "medium" : "low",
    usedData: ["birth weights", "100-day weaning weights", "daily gain calculations"],
    warnings:
      g.count < 5 ? ["Small sample — add more weight records for reliable averages."] : [],
    suggestedNextQuestions: [
      "Which sire produces the heaviest lambs?",
      "How do singles compare to twins?",
      "What's my ewe maternal performance?",
    ],
    isFallback: true,
  };
}

function reproductive(ctx: BreedLogAIContext): LocalFallbackResult {
  const r = ctx.reproductive;
  if (r.ewesJoined === 0) {
    return {
      answer:
        "No breeding events recorded. Add ewe–ram pairings in the Breeding section to track reproductive efficiency.",
      confidence: "insufficient",
      usedData: ["breeding event records"],
      warnings: ["Record breeding events (ewe + ram pairings) to enable reproductive metrics."],
      suggestedNextQuestions: ["What's my herd summary?", "What needs my attention first?"],
      isFallback: true,
    };
  }
  const lrPct = r.lambingRatePct !== null ? `${r.lambingRatePct.toFixed(1)}%` : "—";
  const lpej = r.lambsPerEweJoined !== null ? r.lambsPerEweJoined.toFixed(2) : "—";
  const lines: string[] = [
    `Ewes joined: ${r.ewesJoined}`,
    `Ewes lambed: ${r.ewesLambed}  (lambing rate: ${lrPct})`,
    `Total lambs born: ${r.totalLambsBorn}`,
    `Lambs per ewe joined: ${lpej}`,
    `Active mating groups: ${r.groupCount}`,
  ];
  return {
    answer: lines.join("\n"),
    confidence: r.ewesJoined >= 5 ? "high" : "medium",
    usedData: ["breeding events", "lambing records", "mating groups"],
    warnings: [],
    suggestedNextQuestions: [
      "Which ewes are performing best?",
      "What are my lamb growth averages?",
      "What's my sire performance?",
    ],
    isFallback: true,
  };
}

function health(ctx: BreedLogAIContext): LocalFallbackResult {
  const h = ctx.health;
  if (h.totalAnimalRecords === 0 && h.totalFlockEvents === 0) {
    return {
      answer:
        "No health records found. Add health events (vaccinations, treatments, drenching) in the Health section to track herd health trends.",
      confidence: "insufficient",
      usedData: ["health records"],
      warnings: ["No health records found. Log treatment and vaccination events to track trends."],
      suggestedNextQuestions: ["What needs my attention first?", "What's my overall herd summary?"],
      isFallback: true,
    };
  }
  const lines: string[] = [
    `Animal health records: ${h.totalAnimalRecords}  |  Flock events: ${h.totalFlockEvents}`,
    `Animals treated: ${h.animalsTreated}`,
    `Records in last 30 days: ${h.recentRecords30Days}`,
    `Mortality count: ${h.mortalityCount}`,
  ];
  if (h.topTreatments.length > 0) {
    lines.push(`\nMost common treatments:`);
    h.topTreatments.slice(0, 5).forEach((t) => {
      lines.push(`• ${t.name}: ${t.count} time(s)`);
    });
  }
  return {
    answer: lines.join("\n"),
    confidence: h.totalAnimalRecords > 0 ? "high" : "medium",
    usedData: ["health records", "flock health events", "mortality records"],
    warnings:
      h.mortalityCount > 0 ? [`${h.mortalityCount} mortality record(s) in this workspace.`] : [],
    suggestedNextQuestions: [
      "What needs my attention first?",
      "What's my overall herd summary?",
      "How is my data quality?",
    ],
    isFallback: true,
  };
}

function priorityList(ctx: BreedLogAIContext): LocalFallbackResult {
  const priorities: string[] = [];
  const m = ctx.missingData;
  const h = ctx.herd;

  if (h.total === 0) {
    priorities.push("Add animals to BreedLog to start tracking your herd.");
  } else {
    if (m.noBirthWeight > 0) priorities.push(`Record birth weights for ${m.noBirthWeight} animal(s).`);
    if (m.noWeaningWeight > 0) priorities.push(`Add weaning weights for ${m.noWeaningWeight} animal(s).`);
    if (m.noSireLink > 0) priorities.push(`Link ${m.noSireLink} animal(s) to their sire for performance tracking.`);
    if (m.noBirthDate > 0) priorities.push(`Add birth dates for ${m.noBirthDate} animal(s).`);
    if (m.noDamLink > 0) priorities.push(`Link ${m.noDamLink} animal(s) to their dam.`);
  }
  if (ctx.health.mortalityCount > 0) {
    priorities.push(`Review ${ctx.health.mortalityCount} mortality record(s).`);
  }
  if (ctx.ewes.barren > 0 && ctx.ewes.active > 0) {
    priorities.push(
      `${ctx.ewes.barren} ewe(s) have no lambing records — verify whether they were joined.`,
    );
  }
  if (ctx.ewes.watchlist.length > 0) {
    priorities.push(
      `${ctx.ewes.watchlist.length} ewe(s) on watchlist with low weaning rates — consider culling review.`,
    );
  }

  const answer =
    priorities.length === 0
      ? `Your records look complete for ${h.total} animals. Keep adding weights, breeding events, and health records to maintain quality.`
      : `Top ${priorities.length} priority action${priorities.length === 1 ? "" : "s"}:\n${priorities
          .map((p, i) => `${i + 1}. ${p}`)
          .join("\n")}`;

  return {
    answer,
    confidence: "high",
    usedData: [
      "data quality audit",
      "health records",
      "ewe maternal records",
      "missing field counts",
    ],
    warnings: [],
    suggestedNextQuestions: [
      "How is my data quality?",
      "What's my herd summary?",
      "Which sire is performing best?",
    ],
    isFallback: true,
  };
}

// ─── Category detection ──────────────────────────────────────────────────────

function detectCategory(question: string, category?: string): string {
  if (category) return category;
  const q = question.toLowerCase();
  if (
    q.includes("attention") || q.includes("priority") || q.includes("urgent") ||
    q.includes("action") || q.includes("first") || q.includes("focus")
  ) return "priority";
  if (
    q.includes("data quality") || q.includes("complete") || q.includes("missing") ||
    q.includes("gaps") || q.includes("quality score") || q.includes("fill in")
  ) return "data-quality";
  if (
    q.includes("ram") || q.includes("sire") || q.includes("bull") ||
    q.includes("male") || q.includes("father")
  ) return "sire-performance";
  if (
    q.includes("ewe") || q.includes("dam") || q.includes("maternal") ||
    q.includes("mother") || q.includes("female")
  ) return "ewe-performance";
  if (
    q.includes("lamb") || q.includes("growth") || q.includes("weaning") ||
    q.includes("birth weight") || q.includes("adg") || q.includes("daily gain")
  ) return "lamb-growth";
  if (
    q.includes("breed") || q.includes("mating") || q.includes("joined") ||
    q.includes("lambing rate") || q.includes("reproductive") || q.includes("group")
  ) return "reproductive";
  if (
    q.includes("health") || q.includes("treatment") || q.includes("vaccine") ||
    q.includes("drench") || q.includes("mortality") || q.includes("sick") ||
    q.includes("medication")
  ) return "health";
  return "herd-overview";
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generateLocalFallback(
  question: string,
  ctx: BreedLogAIContext,
  category?: string,
): LocalFallbackResult {
  const cat = detectCategory(question, category);
  switch (cat) {
    case "data-quality":      return dataQuality(ctx);
    case "sire-performance":  return sirePerformance(ctx);
    case "ewe-performance":   return ewePerformance(ctx);
    case "lamb-growth":       return lambGrowth(ctx);
    case "reproductive":      return reproductive(ctx);
    case "health":            return health(ctx);
    case "priority":          return priorityList(ctx);
    default:                  return herdOverview(ctx);
  }
}
