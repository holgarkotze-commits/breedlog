export interface PromptCategory {
  key: string;
  label: string;
  prompts: string[];
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    key: "herd-overview",
    label: "Herd Overview",
    prompts: [
      "Summarize my herd.",
      "What stands out most in my current records?",
      "What needs my attention first?",
      "How many animals do I have and how are they distributed?",
    ],
  },
  {
    key: "sire-performance",
    label: "Ram / Sire Performance",
    prompts: [
      "Which ram appears to be performing best?",
      "Which sire has the strongest lamb growth records?",
      "Which ram has the weakest recorded output?",
      "How many progeny does each sire have recorded?",
    ],
  },
  {
    key: "ewe-maternal",
    label: "Ewe Maternal Performance",
    prompts: [
      "Which ewes look like top performers?",
      "Which ewes should be on my watchlist?",
      "Which ewes look like passengers based on my records?",
      "How many ewes lambed vs how many are recorded as barren?",
    ],
  },
  {
    key: "lamb-growth",
    label: "Lamb Growth",
    prompts: [
      "Explain my lamb growth performance.",
      "Which lamb group is growing best based on my records?",
      "What growth data is missing?",
      "Compare my single-born vs twin-born lamb weights.",
    ],
  },
  {
    key: "breeding-lambing",
    label: "Breeding & Lambing",
    prompts: [
      "Summarize my lambing results.",
      "Which breeding group performed best?",
      "What is my lambs-per-ewe result?",
      "What is my recorded lambing rate?",
    ],
  },
  {
    key: "health-records",
    label: "Health Records",
    prompts: [
      "Summarize recorded health events.",
      "Which animals have repeated health issues?",
      "What are my most common recorded treatments?",
      "What follow-ups are recorded as pending?",
    ],
  },
  {
    key: "data-quality",
    label: "Data Quality",
    prompts: [
      "What records are missing from my data?",
      "Can I trust my current Data tab results?",
      "What should I record next to improve my analysis?",
      "How complete is my herd data?",
    ],
  },
  {
    key: "market-readiness",
    label: "Auction / Market Readiness",
    prompts: [
      "Which animals look closest to market readiness based on recorded weights?",
      "What records do I need before auction selection?",
      "Which groups should I review for sale readiness?",
    ],
  },
  {
    key: "animal-profile",
    label: "Animal Profile Help",
    prompts: [
      "Summarize this animal's records.",
      "What is missing from this animal's profile?",
      "Is this animal contributing well based on recorded data?",
    ],
  },
];

export const CATEGORY_KEYS = PROMPT_CATEGORIES.map((c) => c.key);
