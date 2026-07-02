// =====================================================
// Structured Question Bank
// Each question chip is validated against either a
// knowledge entry or a data capability before rendering.
// =====================================================

export interface QuestionChip {
  id: string;
  label: string;
  questionText: string;
  answerSourceType: "knowledge" | "appData" | "hybrid";
  requiredKnowledgeIds: string[];
  requiredDataCapabilities: string[];
  appArea: string;
  enabled: boolean;
}

export const QUESTION_BANK: QuestionChip[] = [
  // ---- Herd Overview (appData) ----
  { id: "herd-summarize", label: "Summarize my herd", questionText: "Summarize my herd.", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["herd.total", "herd.rams", "herd.ewes", "herd.lambs"], appArea: "herd-overview", enabled: true },
  { id: "herd-attention", label: "What needs attention?", questionText: "What needs my attention first based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["herd.total", "health.totalAnimalRecords"], appArea: "herd-overview", enabled: true },
  { id: "herd-distribution", label: "How are animals distributed?", questionText: "How many animals do I have and how are they distributed?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["herd.total", "herd.rams", "herd.ewes", "herd.lambs"], appArea: "herd-overview", enabled: true },
  { id: "herd-standout", label: "What stands out most?", questionText: "What stands out most in my current records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["herd.total"], appArea: "herd-overview", enabled: true },

  // ---- Ram / Sire Performance (appData) ----
  { id: "ram-best", label: "Best performing ram?", questionText: "Which ram appears to be performing best based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["sires"], appArea: "sire-performance", enabled: true },
  { id: "ram-strongest-growth", label: "Best lamb growth sire?", questionText: "Which sire has the strongest lamb growth records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["sires", "lambGrowth.avgBirthWeight"], appArea: "sire-performance", enabled: true },
  { id: "ram-weakest", label: "Weakest ram output?", questionText: "Which ram has the weakest recorded output?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["sires"], appArea: "sire-performance", enabled: true },
  { id: "ram-progeny", label: "Progeny count per sire?", questionText: "How many progeny does each sire have recorded?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["sires"], appArea: "sire-performance", enabled: true },

  // ---- Ewe Maternal Performance (appData) ----
  { id: "ewe-top", label: "Top performing ewes?", questionText: "Which ewes look like top performers based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["ewes.topPerformers"], appArea: "ewe-maternal", enabled: true },
  { id: "ewe-watchlist", label: "Ewes to watch?", questionText: "Which ewes should be on my watchlist based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["ewes.watchlist"], appArea: "ewe-maternal", enabled: true },
  { id: "ewe-passengers", label: "Ewes not contributing?", questionText: "Which ewes look like passengers based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["ewes.barren", "ewes.watchlist"], appArea: "ewe-maternal", enabled: true },
  { id: "ewe-lambed-barren", label: "Lambed vs barren ewes?", questionText: "How many ewes lambed vs how many are recorded as barren?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["ewes.lambed", "ewes.barren"], appArea: "ewe-maternal", enabled: true },

  // ---- Lamb Growth (appData) ----
  { id: "lamb-growth", label: "Lamb growth performance?", questionText: "Explain my lamb growth performance based on my records.", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["lambGrowth.count", "lambGrowth.avgADG"], appArea: "lamb-growth", enabled: true },
  { id: "lamb-best-group", label: "Best growing lamb group?", questionText: "Which lamb group is growing best based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["lambGrowth"], appArea: "lamb-growth", enabled: true },
  { id: "lamb-missing-data", label: "What growth data is missing?", questionText: "What growth data is missing from my lamb records?", answerSourceType: "hybrid", requiredKnowledgeIds: ["weight-records"], requiredDataCapabilities: ["missingData", "lambGrowth"], appArea: "lamb-growth", enabled: true },
  { id: "lamb-single-vs-twin", label: "Single vs twin weights?", questionText: "Compare my single-born vs twin-born lamb weights based on my records.", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["lambGrowth.singleCount", "lambGrowth.twinCount"], appArea: "lamb-growth", enabled: true },

  // ---- Breeding & Lambing (appData) ----
  { id: "lambing-results", label: "Summarize lambing results", questionText: "Summarize my lambing results.", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["reproductive.ewesJoined", "reproductive.ewesLambed"], appArea: "breeding-lambing", enabled: true },
  { id: "breeding-best-group", label: "Best breeding group?", questionText: "Which breeding group performed best based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["reproductive.groupCount"], appArea: "breeding-lambing", enabled: true },
  { id: "lambs-per-ewe", label: "Lambs per ewe?", questionText: "What is my lambs-per-ewe result based on my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["reproductive.lambsPerEweJoined"], appArea: "breeding-lambing", enabled: true },
  { id: "lambing-rate", label: "Lambing rate?", questionText: "What is my recorded lambing rate?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["reproductive.lambingRatePct"], appArea: "breeding-lambing", enabled: true },

  // ---- Health Records (appData) ----
  { id: "health-summary", label: "Summarize health events", questionText: "Summarize recorded health events in my records.", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["health.totalAnimalRecords", "health.totalFlockEvents"], appArea: "health-records", enabled: true },
  { id: "health-repeated", label: "Animals with repeated health issues?", questionText: "Which animals have repeated health issues in my records?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["health.totalAnimalRecords"], appArea: "health-records", enabled: true },
  { id: "health-common-treatments", label: "Most common treatments?", questionText: "What are my most common recorded treatments?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["health.topTreatments"], appArea: "health-records", enabled: true },

  // ---- Data Quality (appData) ----
  { id: "data-missing", label: "What records are missing?", questionText: "What records are missing from my data?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["missingData"], appArea: "data-quality", enabled: true },
  { id: "data-trust", label: "Can I trust my Data tab?", questionText: "Can I trust my current Data tab results?", answerSourceType: "hybrid", requiredKnowledgeIds: ["data-tab"], requiredDataCapabilities: ["missingData", "workspace.dataQualityScore"], appArea: "data-quality", enabled: true },
  { id: "data-next-record", label: "What should I record next?", questionText: "What should I record next to improve my analysis?", answerSourceType: "hybrid", requiredKnowledgeIds: ["add-edit-animals", "weight-records"], requiredDataCapabilities: ["missingData"], appArea: "data-quality", enabled: true },
  { id: "data-complete", label: "How complete is my data?", questionText: "How complete is my herd data?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["workspace.dataQualityScore", "missingData"], appArea: "data-quality", enabled: true },

  // ---- Market Readiness (appData) ----
  { id: "market-ready", label: "Which animals closest to market?", questionText: "Which animals look closest to market readiness based on recorded weights?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["lambGrowth", "sires"], appArea: "market-readiness", enabled: true },
  { id: "market-records-needed", label: "Records needed before auction?", questionText: "What records do I need before auction selection?", answerSourceType: "hybrid", requiredKnowledgeIds: ["exports", "records-tab"], requiredDataCapabilities: ["missingData"], appArea: "market-readiness", enabled: true },

  // ---- App Help (knowledge) ----
  { id: "help-herd-vs-data", label: "My Herd vs Data tab?", questionText: "What is the difference between My Herd and Data?", answerSourceType: "knowledge", requiredKnowledgeIds: ["my-herd", "data-tab"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-add-ram", label: "How to add a ram?", questionText: "How do I add a ram?", answerSourceType: "knowledge", requiredKnowledgeIds: ["rams"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-record-lambing", label: "How to record a ewe lambing?", questionText: "How do I record a ewe lambing?", answerSourceType: "knowledge", requiredKnowledgeIds: ["breeding", "productivity-logs"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-mating-group", label: "How to create a mating group?", questionText: "How do I create a mating group?", answerSourceType: "knowledge", requiredKnowledgeIds: ["mating-groups"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-health-exports", label: "Where do health exports go?", questionText: "Where do exported health records go?", answerSourceType: "knowledge", requiredKnowledgeIds: ["exported-documents", "health-records"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-export-pdf", label: "How to export a PDF?", questionText: "How do I export a PDF?", answerSourceType: "knowledge", requiredKnowledgeIds: ["exports"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-export-json", label: "Can I export JSON?", questionText: "Can I export JSON?", answerSourceType: "knowledge", requiredKnowledgeIds: ["exports", "exported-documents"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-sold-not-visible", label: "Why can't I see a sold animal?", questionText: "Why can't I see a sold animal in My Herd?", answerSourceType: "knowledge", requiredKnowledgeIds: ["my-herd", "records-tab"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-find-culled", label: "How to find culled animals?", questionText: "How do I find culled animals?", answerSourceType: "knowledge", requiredKnowledgeIds: ["records-tab"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-install-phone", label: "Install on phone?", questionText: "How do I install BreedLog on my phone?", answerSourceType: "knowledge", requiredKnowledgeIds: ["install-pwa"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-install-desktop", label: "Install on desktop?", questionText: "How do I install BreedLog on my desktop?", answerSourceType: "knowledge", requiredKnowledgeIds: ["install-pwa"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-report-bug", label: "How to report a bug?", questionText: "How do I report a bug or issue?", answerSourceType: "knowledge", requiredKnowledgeIds: ["issue-reporting"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-field-test", label: "What to test?", questionText: "What must I test during the final field test?", answerSourceType: "knowledge", requiredKnowledgeIds: ["field-testing"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-productivity-exports", label: "Where are productivity exports saved?", questionText: "Where are productivity exports saved?", answerSourceType: "knowledge", requiredKnowledgeIds: ["exported-documents", "productivity-logs"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-sync", label: "What does sync mean?", questionText: "What does sync mean in BreedLog?", answerSourceType: "knowledge", requiredKnowledgeIds: ["sync-offline"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },
  { id: "help-save-code", label: "How to save my access code?", questionText: "How do I save my access code?", answerSourceType: "knowledge", requiredKnowledgeIds: ["access-codes"], requiredDataCapabilities: [], appArea: "app-help", enabled: true },

  // ---- Genetics & Bloodlines (knowledge + hybrid) ----
  { id: "genetics-how-check-risk", label: "How to check mating risk?", questionText: "How do I check mating risk before pairing a ram and ewe?", answerSourceType: "knowledge", requiredKnowledgeIds: ["mating-risk", "genetics-bloodlines"], requiredDataCapabilities: [], appArea: "genetics", enabled: true },
  { id: "genetics-critical-risk", label: "What does critical mating risk mean?", questionText: "What does critical mating risk mean and what should I do?", answerSourceType: "knowledge", requiredKnowledgeIds: ["mating-risk"], requiredDataCapabilities: [], appArea: "genetics", enabled: true },
  { id: "genetics-create-bloodline", label: "How to create a bloodline?", questionText: "How do I create a bloodline in BreedLog?", answerSourceType: "knowledge", requiredKnowledgeIds: ["genetics-bloodlines"], requiredDataCapabilities: [], appArea: "genetics", enabled: true },
  { id: "genetics-ebv-asbv", label: "Does BreedLog generate EBVs?", questionText: "Does BreedLog generate EBVs or ASBVs?", answerSourceType: "knowledge", requiredKnowledgeIds: ["genetics-bloodlines"], requiredDataCapabilities: [], appArea: "genetics", enabled: true },

  // ---- Animal Profile Help (hybrid) ----
  { id: "animal-summarize", label: "Summarize this animal", questionText: "Summarize this animal's records.", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["selectedAnimal"], appArea: "animal-profile", enabled: true },
  { id: "animal-missing", label: "What is missing from this profile?", questionText: "What is missing from this animal's profile?", answerSourceType: "hybrid", requiredKnowledgeIds: ["add-edit-animals"], requiredDataCapabilities: ["selectedAnimal"], appArea: "animal-profile", enabled: true },
  { id: "animal-contributing", label: "Is this animal contributing?", questionText: "Is this animal contributing well based on recorded data?", answerSourceType: "appData", requiredKnowledgeIds: [], requiredDataCapabilities: ["selectedAnimal"], appArea: "animal-profile", enabled: true },
];

// Grouped view for the UI
export interface PromptCategory {
  key: string;
  label: string;
  prompts: string[];
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    key: "herd-overview",
    label: "Herd Overview",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "herd-overview" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "sire-performance",
    label: "Ram / Sire Performance",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "sire-performance" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "ewe-maternal",
    label: "Ewe Maternal Performance",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "ewe-maternal" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "lamb-growth",
    label: "Lamb Growth",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "lamb-growth" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "breeding-lambing",
    label: "Breeding & Lambing",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "breeding-lambing" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "health-records",
    label: "Health Records",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "health-records" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "data-quality",
    label: "Data Quality",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "data-quality" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "market-readiness",
    label: "Auction / Market Readiness",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "market-readiness" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "app-help",
    label: "App Help & How-To",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "app-help" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "genetics",
    label: "Genetics & Bloodlines",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "genetics" && q.enabled).map((q) => q.questionText),
  },
  {
    key: "animal-profile",
    label: "Animal Profile Help",
    prompts: QUESTION_BANK.filter((q) => q.appArea === "animal-profile" && q.enabled).map((q) => q.questionText),
  },
];

export const CATEGORY_KEYS = PROMPT_CATEGORIES.map((c) => c.key);
