export const HEALTH_PLAN_DISCLAIMER = "This is a general livestock health planning guide. Always follow Namibian veterinary regulations, product labels, withdrawal periods, and consult a local veterinarian for diagnosis and treatment.";

export const HEALTH_EVENT_TYPES = [
  "vaccination",
  "dosing_deworming",
  "external_parasite_treatment",
  "antibiotic_treatment",
  "vitamin_mineral_supplement",
  "injury_wound",
  "abscess",
  "footrot",
  "mastitis",
  "observation_symptom",
  "vet_visit",
] as const;

export const HEALTH_ROUTE_OPTIONS = [
  "oral",
  "subcutaneous",
  "intramuscular",
  "topical",
  "pour_on",
  "dip_spray",
  "other",
] as const;

export type HealthEventType = (typeof HEALTH_EVENT_TYPES)[number];

export interface HealthPlanCard {
  title: string;
  explanation: string;
  watchFor: string[];
  recordInBreedLog: string[];
  suggestedActionLabel: string;
  suggestedEventType: HealthEventType;
}

export interface HealthPlanTopic {
  id: string;
  label: string;
  cards: HealthPlanCard[];
}

export const HEALTH_PLAN_TOPICS: HealthPlanTopic[] = [
  {
    id: "purpose-safety",
    label: "Purpose & Safety Notice",
    cards: [
      {
        title: "Why this Health Plan exists",
        explanation:
          "Use this guide to organize daily observation, prevention planning, parasite control, vaccination planning, health-event recording, follow-up dates, and treatment history.",
        watchFor: ["Daily behaviour changes", "Condition changes", "Missed prevention tasks"],
        recordInBreedLog: ["Health event type", "Date", "Animals treated", "Follow-up date"],
        suggestedActionLabel: "Record health event",
        suggestedEventType: "observation_symptom",
      },
      {
        title: "Prevention first principle",
        explanation:
          "Prevention is better than cure. Observe livestock condition and behaviour every day. Record health actions immediately so that treatments, follow-ups, and withdrawal periods are not forgotten.",
        watchFor: ["Skipped boosters", "Delayed records", "Unclear treatment history"],
        recordInBreedLog: ["Booster due date", "Withdrawal notes", "Outcome notes"],
        suggestedActionLabel: "Record follow-up",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "daily-observation",
    label: "Daily Animal Observation",
    cards: [
      {
        title: "Healthy signs",
        explanation: "Healthy animals are usually active, alert, eating normally and moving without effort.",
        watchFor: [
          "Active and attentive",
          "Smooth or shiny coat",
          "Social with the group",
          "Strong body condition",
          "Normal movement and breathing",
        ],
        recordInBreedLog: ["Normal observation notes", "Group condition trends"],
        suggestedActionLabel: "Record observation",
        suggestedEventType: "observation_symptom",
      },
      {
        title: "Sick warning signs",
        explanation: "Record warning signs early and seek local veterinary support if signs worsen or spread.",
        watchFor: [
          "Inactive or weak animals",
          "Dull eyes or rough coat",
          "Poor appetite or isolation",
          "Lameness, diarrhoea, nasal discharge, coughing",
          "Swelling, wounds, unusual behaviour, sudden condition drop",
        ],
        recordInBreedLog: ["Observed symptoms", "Animal IDs", "When signs started", "Escalation notes"],
        suggestedActionLabel: "Record observation",
        suggestedEventType: "observation_symptom",
      },
    ],
  },
  {
    id: "planning-principles",
    label: "Health Planning Principles",
    cards: [
      {
        title: "Core planning pillars",
        explanation:
          "Build your plan around proper husbandry, disease control, farm and kraal hygiene, clean environment, nutrition, feed quality and quantity, handling and animal welfare, movement protocols, vaccination and parasite calendars, breeding-season timing, age and production status, gestation/lactation context, and complete records.",
        watchFor: ["Dirty kraals", "Feed quality issues", "Stress periods", "High-risk breeding windows"],
        recordInBreedLog: ["Vaccination plans", "Parasite plans", "Breeding-season checks"],
        suggestedActionLabel: "Record vaccination",
        suggestedEventType: "vaccination",
      },
      {
        title: "Plan with local risk context",
        explanation:
          "Consider local disease pressure, parasite patterns, medicine availability, storage conditions, legal requirements, and production stage.",
        watchFor: ["Seasonal disease changes", "Gestation/lactation stress", "Storage concerns"],
        recordInBreedLog: ["Vet advice notes", "Product used", "Follow-up dates"],
        suggestedActionLabel: "Record vet visit",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "disease-risk",
    label: "Disease Sources & Risk Factors",
    cards: [
      {
        title: "Infectious and parasite sources",
        explanation: "Health problems may come from parasites, bacteria, viruses, protozoa, and overlapping mixed burdens.",
        watchFor: ["Recurring sickness", "Poor response trends", "Clustered cases"],
        recordInBreedLog: ["Suspected source", "Affected group", "Vet follow-up"],
        suggestedActionLabel: "Record observation",
        suggestedEventType: "observation_symptom",
      },
      {
        title: "Management and environment risks",
        explanation:
          "Poisoning, poor feed quantity/quality, mineral or vitamin deficiencies, injuries, stress, and dirty wet kraals increase risk.",
        watchFor: ["Injuries", "Feed shortages", "Wet bedding", "Stress after movement"],
        recordInBreedLog: ["Injury events", "Environmental notes", "Corrective actions"],
        suggestedActionLabel: "Record injury/wound",
        suggestedEventType: "injury_wound",
      },
    ],
  },
  {
    id: "vaccination-prevention",
    label: "Vaccination & Prevention",
    cards: [
      {
        title: "Vaccination planning",
        explanation:
          "Vaccines are mainly for prevention in healthy animals. Record batch and individual vaccination events and keep booster timing visible.",
        watchFor: ["Booster due dates", "High-risk periods", "Animals missed in batch work"],
        recordInBreedLog: ["Event type vaccination", "Product", "Route", "Next booster date", "Withdrawal notes"],
        suggestedActionLabel: "Record vaccination",
        suggestedEventType: "vaccination",
      },
      {
        title: "Farm-specific caution",
        explanation:
          "Do not assume one vaccination plan fits every farm. Confirm timing, product choice, and legal requirements with a local veterinarian and product label.",
        watchFor: ["Pre-mating prevention gaps", "Youngstock schedule gaps"],
        recordInBreedLog: ["Veterinary guidance summary", "Planned booster"],
        suggestedActionLabel: "Record vet visit",
        suggestedEventType: "vet_visit",
      },
      {
        title: "Prevention conditions to plan for",
        explanation:
          "Include prevention planning for Pulpy Kidney, Pasteurellosis, Tetanus, Malignant oedema, Blackquarter, Botulism, Anthrax, Lumpy skin disease (where relevant), and reproductive disease prevention before mating.",
        watchFor: ["Condition risk windows", "Herd immunity gaps"],
        recordInBreedLog: ["Condition-focused prevention event", "Booster due date"],
        suggestedActionLabel: "Record booster",
        suggestedEventType: "vaccination",
      },
    ],
  },
  {
    id: "parasite-control",
    label: "Parasite Control",
    cards: [
      {
        title: "Internal and external parasite risks",
        explanation:
          "Monitor roundworms, flukes, ticks, tapeworms, lice, mites, nasal bot, and irritation-related condition loss.",
        watchFor: ["Anaemia", "Rough coat", "Poor body condition", "Scratching", "Nasal discharge", "Diarrhoea"],
        recordInBreedLog: ["Parasite treatment event", "Observed burden signs", "Follow-up date"],
        suggestedActionLabel: "Record dosing/deworming",
        suggestedEventType: "dosing_deworming",
      },
      {
        title: "Seasonality and resistance planning",
        explanation:
          "As a general planning rule, control parasites at least twice per year and adjust for rainfall/seasonal pressure. Rotate remedy groups with guidance to reduce resistance risk.",
        watchFor: ["Wet-season spikes", "Repeat treatment failure", "Poor-condition animals"],
        recordInBreedLog: ["Remedy group used", "Next planned treatment", "Response notes"],
        suggestedActionLabel: "Record external parasite treatment",
        suggestedEventType: "external_parasite_treatment",
      },
      {
        title: "Before internal parasite control",
        explanation:
          "Before internal parasite control, consider whether Pulpy Kidney vaccination or booster timing is required according to farm prevention plan and veterinary guidance.",
        watchFor: ["Booster timing gaps"],
        recordInBreedLog: ["Linked booster event", "Follow-up date"],
        suggestedActionLabel: "Record follow-up date",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "medicine-failure",
    label: "Medicine Failure Warning Signs",
    cards: [
      {
        title: "Why programs fail",
        explanation:
          "Failure can come from expired or badly stored medicine, poor mixing, incorrect diagnosis, incorrect use, missing boosters, wrong timing, stressed animals, or heavy untreated burdens.",
        watchFor: ["No response after treatment", "Worsening signs", "Repeated recurrence"],
        recordInBreedLog: ["Treatment used", "Observed response", "Follow-up date", "Vet escalation"],
        suggestedActionLabel: "Record treatment",
        suggestedEventType: "antibiotic_treatment",
      },
      {
        title: "Escalate safely",
        explanation: "When treatment response is poor, record the case and seek local veterinary advice quickly.",
        watchFor: ["Rapid deterioration", "Clustered failures"],
        recordInBreedLog: ["Vet visit", "Outcome notes"],
        suggestedActionLabel: "Record vet visit",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "health-calendar",
    label: "Sheep & Goat Health Calendar",
    cards: [
      {
        title: "Annual planning checkpoints",
        explanation:
          "Plan Pasteurella and Pulpy Kidney prevention windows, booster cycles, Vitamin A support where applicable, and parasite control at least twice yearly.",
        watchFor: ["Booster windows", "Seasonal parasite peaks"],
        recordInBreedLog: ["Vaccination event", "Booster event", "Supplement event"],
        suggestedActionLabel: "Record vaccination",
        suggestedEventType: "vaccination",
      },
      {
        title: "Reproductive cycle checks",
        explanation:
          "Plan health checks before mating, during late pregnancy, during lactation, and post-birth lamb/kid observation. Reproductive disease prevention planning is typically 4–6 weeks before mating under veterinary guidance.",
        watchFor: ["Body condition before mating", "Late-pregnancy health shifts", "Post-birth stress"],
        recordInBreedLog: ["Mating-season health preparation", "Observation notes", "Follow-up dates"],
        suggestedActionLabel: "Record mating-season health preparation",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "common-conditions",
    label: "Common Conditions",
    cards: [
      {
        title: "Condition awareness set 1",
        explanation:
          "Track Pulpy Kidney, Pasteurellosis, Tetanus, Malignant oedema, Blackquarter, Botulism, Anthrax, and reproductive disease/abortion risk with early record capture.",
        watchFor: ["Sudden losses", "Depressed behaviour", "Nervous signs", "Abortions"],
        recordInBreedLog: ["Suspected condition", "Vaccination/booster history", "Vet follow-up"],
        suggestedActionLabel: "Record observation",
        suggestedEventType: "observation_symptom",
      },
      {
        title: "Condition awareness set 2",
        explanation:
          "Watch for Anaplasmosis/gallsickness, sweating sickness, warts, orf, lumpy skin disease, parasite infestation, pneumonia, coccidiosis/scours, pink eye, and heartwater where relevant.",
        watchFor: ["Eye changes", "Respiratory signs", "Skin lesions", "Scours", "Tick-related symptoms"],
        recordInBreedLog: ["Observed signs", "Animal/group affected", "Vet referral"],
        suggestedActionLabel: "Record vet visit",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "wounds-footrot-mastitis",
    label: "Wounds, Footrot & Mastitis",
    cards: [
      {
        title: "Wounds and injuries",
        explanation:
          "Watch for cuts, swelling, bleeding, flies, discharge, or pain. Clean and manage according to farm hygiene practice and seek veterinary support for severe cases.",
        watchFor: ["Open wound", "Heat/swelling", "Discharge", "Pain"],
        recordInBreedLog: ["Injury event", "Support action", "Date", "Follow-up"],
        suggestedActionLabel: "Record wound/injury",
        suggestedEventType: "injury_wound",
      },
      {
        title: "Abscess management",
        explanation:
          "Record and manage abscesses hygienically; escalate if severe, painful, or spreading.",
        watchFor: ["Painful swelling", "Hot lump", "Discharge"],
        recordInBreedLog: ["Abscess event", "Follow-up review"],
        suggestedActionLabel: "Record abscess",
        suggestedEventType: "abscess",
      },
      {
        title: "Footrot and mastitis",
        explanation:
          "Footrot risk rises in wet/dirty conditions; mastitis needs urgent attention and veterinary guidance.",
        watchFor: ["Lameness and foul hoof smell", "Udder heat/swelling", "Abnormal milk", "Weak lamb intake"],
        recordInBreedLog: ["Footrot or mastitis event", "Affected animal", "Withdrawal notes", "Follow-up date"],
        suggestedActionLabel: "Record footrot",
        suggestedEventType: "footrot",
      },
    ],
  },
  {
    id: "deficiencies",
    label: "Deficiencies & Nutrition-Related Health",
    cards: [
      {
        title: "Mineral and vitamin awareness",
        explanation:
          "Monitor phosphorus deficiency risk, mineral imbalance, and broad vitamin support needs (A, C, E, B-complex) as part of farm nutrition planning.",
        watchFor: ["Poor growth", "Weakness", "Rough coat", "Poor reproduction", "General poor condition"],
        recordInBreedLog: ["Supplement event", "Observed deficiency signs", "Vet advice"],
        suggestedActionLabel: "Record supplement",
        suggestedEventType: "vitamin_mineral_supplement",
      },
      {
        title: "When to escalate",
        explanation:
          "Eye, respiratory, joint, appetite, and condition warning patterns should be recorded and reviewed with a veterinarian.",
        watchFor: ["Persistent eye signs", "Joint problems", "Abnormal appetite"],
        recordInBreedLog: ["Observation event", "Vet visit"],
        suggestedActionLabel: "Record vet visit",
        suggestedEventType: "vet_visit",
      },
    ],
  },
  {
    id: "records-followup",
    label: "Health Records & Follow-Up",
    cards: [
      {
        title: "What to record every time",
        explanation:
          "A complete record includes event type, product used, dose, route, date, treated animals/groups, next booster or follow-up date, withdrawal notes, observed symptoms, vet visits, and outcomes.",
        watchFor: ["Missing follow-up dates", "Unclear treatment history", "Missed withdrawal notes"],
        recordInBreedLog: ["Full event detail", "Outcome notes", "Next follow-up date"],
        suggestedActionLabel: "Record health event",
        suggestedEventType: "observation_symptom",
      },
      {
        title: "Why records protect the farm",
        explanation:
          "Good records reduce missed boosters, repeated mistakes, forgotten withdrawal periods, and uncertainty during disease pressure.",
        watchFor: ["Repeated events in same group", "Late follow-ups"],
        recordInBreedLog: ["Trend notes", "Corrective actions"],
        suggestedActionLabel: "Record follow-up",
        suggestedEventType: "vet_visit",
      },
    ],
  },
];
