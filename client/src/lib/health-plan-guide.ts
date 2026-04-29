export const HEALTH_PLAN_DISCLAIMER = "This Health Plan is a BreedLog in-app planning guide for livestock recordkeeping and prevention planning. Always follow applicable local veterinary rules, product labels, withdrawal periods, and consult a local veterinarian for diagnosis and treatment.";

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
  treatmentOptions?: string[];
  remedyCategoryOptions?: string[];
  supportOptions?: string[];
  routeOptions?: string[];
  vetWarning?: string;
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
        treatmentOptions: ["Vaccine category for prevention planning", "Booster planning", "Batch vaccination records"],
        routeOptions: ["Use product-label route only"],
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
        remedyCategoryOptions: ["Internal parasite remedy/dewormer", "External parasite treatment", "Nasal bot remedy category"],
        routeOptions: ["oral", "injectable where label allows", "pour-on", "dip/spray", "topical"],
        treatmentOptions: ["Record product, route, date, treated animals, and follow-up"],
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
      { title: "Pulpy Kidney", explanation: "Watch sudden losses and neurological signs; keep prevention planning current.", watchFor:["Sudden deaths","Nervous signs","Fast decline"], recordInBreedLog:["Vaccination status","Observed signs","Vet follow-up"], suggestedActionLabel:"Record vaccination", suggestedEventType:"vaccination", remedyCategoryOptions:["Vaccine/prevention category"], supportOptions:["Emergency isolation and vet escalation"], vetWarning:"Urgent veterinary review for sudden deaths." },
      { title: "Pasteurellosis", explanation: "Respiratory stress-related disease risk rises with weather and handling stress.", watchFor:["Fever","Nasal discharge","Breathing difficulty"], recordInBreedLog:["Symptoms","Group affected","Treatment follow-up"], suggestedActionLabel:"Record vet visit", suggestedEventType:"vet_visit", remedyCategoryOptions:["Vaccine/prevention category","Antibiotic category under vet guidance"], routeOptions:["Product-label route only"], vetWarning:"Escalate quickly for breathing distress or outbreak pattern." },
      { title: "Tetanus", explanation: "Risk increases after wounds/procedures when prevention is weak.", watchFor:["Stiff movement","Muscle spasms","Jaw stiffness"], recordInBreedLog:["Procedure/wound context","Vaccination history","Vet response"], suggestedActionLabel:"Record observation", suggestedEventType:"observation_symptom", remedyCategoryOptions:["Vaccine prevention category","Urgent vet treatment category"], vetWarning:"Emergency veterinary case." },
      { title: "Malignant oedema", explanation: "Severe wound-associated infection risk requiring urgent intervention.", watchFor:["Rapid swelling","Pain","Depression"], recordInBreedLog:["Wound source","Signs timeline","Vet intervention"], suggestedActionLabel:"Record injury/wound", suggestedEventType:"injury_wound", remedyCategoryOptions:["Wound hygiene support","Antibiotic category under vet guidance"], vetWarning:"Urgent veterinary intervention required." },
      { title: "Blackquarter", explanation: "Sudden lameness/swelling syndrome in susceptible groups.", watchFor:["Swelling","Lameness","Sudden death"], recordInBreedLog:["Group and age","Onset date","Vet confirmation"], suggestedActionLabel:"Record vet visit", suggestedEventType:"vet_visit", remedyCategoryOptions:["Vaccine prevention category","Outbreak response under vet guidance"], vetWarning:"Urgent outbreak response needed." },
      { title: "Botulism", explanation: "Neuromuscular weakness risk linked to feed/carcass contamination.", watchFor:["Weakness","Paralysis signs","Difficulty standing"], recordInBreedLog:["Feed source notes","Signs","Vet actions"], suggestedActionLabel:"Record observation", suggestedEventType:"observation_symptom", remedyCategoryOptions:["Feed-risk prevention category","Vet emergency support"], vetWarning:"Immediate veterinary guidance required." },
      { title: "Anthrax", explanation: "High-risk notifiable-like syndrome requiring strict local legal compliance.", watchFor:["Sudden death","Bleeding from openings","Rapid herd concern"], recordInBreedLog:["Immediate isolation actions","Authority/vet contact","No carcass disturbance notes"], suggestedActionLabel:"Record vet visit", suggestedEventType:"vet_visit", remedyCategoryOptions:["Emergency legal/vet response category"], vetWarning:"Follow local law and urgent veterinary/authority instructions." },
      { title: "Reproductive disease / abortion risk", explanation: "Manage pre-mating and pregnancy biosecurity and vaccination planning.", watchFor:["Abortions","Retained placenta","Weak newborns"], recordInBreedLog:["Pregnancy stage","Abortions count","Biosecurity actions"], suggestedActionLabel:"Record observation", suggestedEventType:"observation_symptom", remedyCategoryOptions:["Reproductive prevention category","Vet diagnostic support"], vetWarning:"Escalate for abortion clusters." },
      { title: "Anaplasmosis / gallsickness", explanation: "Tick-associated disease risk in endemic pressure periods.", watchFor:["Pale mucosa","Weakness","Fever"], recordInBreedLog:["Tick burden","Signs","Treatment follow-up"], suggestedActionLabel:"Record external parasite treatment", suggestedEventType:"external_parasite_treatment", remedyCategoryOptions:["Tick control category","Vet-guided treatment category"], routeOptions:["Topical/pour-on/dip-spray per label"], vetWarning:"Escalate for severe anemia or collapse." },
      { title: "Sweating sickness", explanation: "Tick-associated toxicosis risk where relevant.", watchFor:["Skin moisture changes","Weakness","Depression"], recordInBreedLog:["Tick pressure","Clinical observations","Vet actions"], suggestedActionLabel:"Record vet visit", suggestedEventType:"vet_visit", remedyCategoryOptions:["Tick control/prevention category","Supportive vet care category"], vetWarning:"Urgent veterinary support recommended." },
      { title: "Warts", explanation: "Usually self-limiting but record spread and secondary infection risk.", watchFor:["Skin lesions","Growth spread","Irritation"], recordInBreedLog:["Lesion location","Spread trend","Follow-up checks"], suggestedActionLabel:"Record observation", suggestedEventType:"observation_symptom", supportOptions:["Hygiene and monitoring support"], vetWarning:"Escalate if severe or interfering with feeding." },
      { title: "Orf", explanation: "Contagious mouth/skin lesions requiring handling hygiene.", watchFor:["Mouth scabs","Udder lesions","Feeding pain"], recordInBreedLog:["Affected animals","Lesion sites","Isolation/hygiene actions"], suggestedActionLabel:"Record observation", suggestedEventType:"observation_symptom", supportOptions:["Isolation and hygiene support","Secondary infection vet support"], vetWarning:"Use protective handling and consult vet for severe cases." },
      { title: "Lumpy skin disease", explanation: "Vector-linked skin disease risk where regionally relevant.", watchFor:["Skin nodules","Fever","Milk/condition drop"], recordInBreedLog:["Vector pressure","Clinical signs","Vet notification"], suggestedActionLabel:"Record vaccination", suggestedEventType:"vaccination", remedyCategoryOptions:["Vaccine/prevention category","Vector control category"], vetWarning:"Escalate quickly if suspected." },
      { title: "Parasite infestation", explanation: "Internal and external parasite burdens reduce performance and welfare.", watchFor:["Weight loss","Rough coat","Scratching/diarrhoea"], recordInBreedLog:["Parasite type suspected","Treatment category used","Follow-up date"], suggestedActionLabel:"Record dosing/deworming", suggestedEventType:"dosing_deworming", remedyCategoryOptions:["Internal dewormer category","External parasite treatment category"], routeOptions:["Oral, injectable where allowed, topical/pour-on/dip-spray"], treatmentOptions:["Record label dose administered, route, and retreat plan"], vetWarning:"Escalate if poor response or severe burden." },
      { title: "Pneumonia", explanation: "Respiratory illness needs early support and veterinary direction.", watchFor:["Coughing","Rapid breathing","Nasal discharge"], recordInBreedLog:["Signs onset","Animals affected","Treatment follow-up"], suggestedActionLabel:"Record antibiotic treatment", suggestedEventType:"antibiotic_treatment", remedyCategoryOptions:["Antibiotic category under vet guidance","Supportive care category"], vetWarning:"Urgent review for severe respiratory distress." },
      { title: "Coccidiosis / scours", explanation: "Youngstock digestive disease requiring hygiene and hydration focus.", watchFor:["Scours","Dehydration signs","Poor growth"], recordInBreedLog:["Age group","Scours severity","Support actions"], suggestedActionLabel:"Record observation", suggestedEventType:"observation_symptom", remedyCategoryOptions:["Coccidiosis remedy category under vet guidance","Hydration/support category"], vetWarning:"Escalate quickly for dehydration or deaths." },
      { title: "Pink eye", explanation: "Eye infection/irritation can spread in dust and fly pressure.", watchFor:["Tearing","Cloudy eye","Light sensitivity"], recordInBreedLog:["Eye affected","Group spread","Treatment follow-up"], suggestedActionLabel:"Record vet visit", suggestedEventType:"vet_visit", supportOptions:["Fly/dust control support","Vet-guided treatment category"], vetWarning:"Urgent vet check if vision risk signs appear." },
      { title: "Heartwater", explanation: "Tick-borne condition where regionally relevant; monitor neurologic/fever signs.", watchFor:["Fever","Nervous signs","Sudden collapse"], recordInBreedLog:["Tick pressure","Signs timeline","Vet treatment"], suggestedActionLabel:"Record external parasite treatment", suggestedEventType:"external_parasite_treatment", remedyCategoryOptions:["Tick control category","Vet-directed treatment category"], vetWarning:"Emergency veterinary case when suspected." }
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




const GUIDANCE_REQUIRED_TOPIC_IDS = new Set(["parasite-control","vaccination-prevention","medicine-failure","deficiencies","wounds-footrot-mastitis","common-conditions"]);
for (const topic of HEALTH_PLAN_TOPICS) {
  if (!GUIDANCE_REQUIRED_TOPIC_IDS.has(topic.id)) continue;
  for (const card of topic.cards) {
    if (!card.treatmentOptions && !card.remedyCategoryOptions && !card.supportOptions) {
      card.supportOptions = [
        "Use practical remedy/treatment categories only under product-label and veterinary guidance",
        "Record event type, product, route/category, date, treated animals, and follow-up",
      ];
    }
    if (!card.vetWarning) {
      card.vetWarning = "Escalate to a local veterinarian for severe, worsening, outbreak, or unclear cases.";
    }
  }
}

export const HEALTH_CALENDAR_MONTHLY = [
  "January","February","March","April","May","June","July","August","September","October","November","December"
].map((month) => ({
  month,
  planningFocus: `${month} health planning`,
  watchFor: ["Seasonal condition shifts", "Parasite and disease pressure"],
  practicalOptions: ["Vaccination/booster planning", "Parasite remedy category planning", "Supplement support planning"],
  recordInBreedLog: ["Event type", "Product used", "Route", "Follow-up"],
  suggestedEventAction: "observation_symptom" as HealthEventType,
}));

export const HEALTH_CALENDAR_SEASONAL = [
  "Pre-mating preparation","Mating period","Early pregnancy","Late pregnancy","Lambing/kidding","Lactation","Weaning","Dry season","Rainy/wet season","Annual review"
].map((stage) => ({
  stage,
  planningFocus: `${stage} prevention and support planning`,
  watchFor: ["Condition changes", "Missed boosters/follow-ups"],
  practicalOptions: ["Prevention category planning", "Remedy category planning", "Vet review when warning signs escalate"],
  whatToRecord: ["Health event details", "Group/animal", "Withdrawal/follow-up notes"],
  suggestedEventAction: "vet_visit" as HealthEventType,
}));
