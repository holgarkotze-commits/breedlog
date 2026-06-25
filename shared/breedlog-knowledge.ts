export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  audience: "farmer" | "admin" | "all";
  summary: string;
  body: string;
  relatedAppArea: string;
  keywords: string[];
  suggestedQuestions: string[];
  lastUpdated: string;
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "getting-started",
    title: "Quick Start — Getting Started with BreedLog",
    category: "Getting Started",
    audience: "all",
    summary: "How to get started with BreedLog, including installing the app and entering your access code.",
    body: `BreedLog is a livestock management app built for Meatmaster sheep farmers. It works on your phone, tablet, or desktop computer.

To get started:
1. Install BreedLog as an app on your device (see "Installing BreedLog" below).
2. Open the installed app.
3. Enter your invite/access code when prompted.
4. You are now logged in and can start recording animals.

BreedLog stores your data on your device and syncs it to the cloud when you have internet. It works offline too — you can record data without internet and it will sync when you reconnect.

Your access code is tied to your invite. One invite code supports one desktop device and one phone/tablet. If you need access on a second device, contact the BreedLog team.`,
    relatedAppArea: "onboarding",
    keywords: ["start", "begin", "setup", "install", "access code", "invite", "first time"],
    suggestedQuestions: [
      "How do I get started with BreedLog?",
      "How do I install BreedLog on my phone?",
      "What is an access code?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "install-pwa",
    title: "Installing BreedLog as an App",
    category: "Installation",
    audience: "all",
    summary: "How to install BreedLog as an app on iPhone, Android, and desktop computers.",
    body: `BreedLog is a Progressive Web App (PWA). This means you install it directly from your browser — no App Store required.

**iPhone / iPad (iOS Safari):**
1. Open BreedLog in Safari (not Chrome).
2. Tap the Share button at the bottom of the screen (the square with an arrow pointing up).
3. Scroll down and tap "Add to Home Screen".
4. Tap "Add" in the top right.
5. BreedLog now appears on your home screen like a normal app.

**Android Phone (Chrome):**
1. Open BreedLog in Chrome.
2. Tap the three-dot menu in the top right.
3. Tap "Add to Home screen" or "Install app".
4. Tap "Install" or "Add".
5. BreedLog appears on your home screen.

**Desktop (Chrome or Edge):**
1. Open BreedLog in Chrome or Edge.
2. Look for the install icon in the address bar (a computer screen with a down arrow), or
3. Click the three-dot menu → "Install BreedLog".
4. Click "Install".
5. BreedLog opens as a standalone app window.

**Why install it?**
Installing BreedLog gives you the best experience: it opens faster, works better offline, and feels like a native app. We recommend always using the installed version rather than the browser tab.

**Trouble installing?**
- On iPhone, you must use Safari — Chrome on iPhone does not support Add to Home Screen.
- On Android, use Chrome or Edge.
- On desktop, use Chrome or Edge for the easiest installation.`,
    relatedAppArea: "install",
    keywords: ["install", "PWA", "home screen", "add to home screen", "iOS", "Android", "Chrome", "Safari", "Edge", "desktop"],
    suggestedQuestions: [
      "How do I install BreedLog on my phone?",
      "How do I install BreedLog on my desktop?",
      "Why should I install BreedLog as an app?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "access-codes",
    title: "Access Codes and Saved Access Code",
    category: "Access & Login",
    audience: "all",
    summary: "How invite codes work, how to save your access code, and how to log out or switch codes.",
    body: `**What is an access code?**
An access code (invite code) is a unique code that gives you access to BreedLog during the field test. Each code is provided by the BreedLog team.

**One code, two devices:**
Each invite code supports one desktop/computer slot and one phone/tablet slot. This means you can use BreedLog on your phone AND your computer with the same code.

**Entering your code:**
When you first open BreedLog, you will be asked to enter your access code. Type your code and tap "Activate Access".

**Saving your access code:**
After you enter your code, BreedLog remembers your access on that device for up to 7 days offline. When you return to the app, it will check your access automatically — you do not need to re-enter your code every time.

You can also enable "Remember my code" on the login screen so your code is pre-filled if you ever need to re-enter it.

**Logging out:**
Logging out clears your access on that device. You will need to enter your code again. Your farm data is not deleted from the cloud.

**What if I lose access?**
If your code is revoked or expired, contact the BreedLog field test team. They can reactivate your code or issue a new one.

**Privacy:**
Your access code is only stored on your own device. BreedLog does not share your farm data with other code holders.`,
    relatedAppArea: "access",
    keywords: ["access code", "invite code", "login", "remember", "save", "logout", "multi-device", "revoked", "expired"],
    suggestedQuestions: [
      "How do I save my access code?",
      "What is an access code?",
      "Can I use BreedLog on two devices?",
      "How do I log out?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "my-herd",
    title: "My Herd and Active Animal Count",
    category: "My Herd",
    audience: "farmer",
    summary: "What My Herd shows, how active animal counts work, and the difference between My Herd and farm records.",
    body: `**What is My Herd?**
My Herd is your main animal list. It shows all animals recorded in BreedLog for your farm.

**What does "active" mean?**
Active animals are those with status "Active" — meaning they are currently on your farm. Animals you have marked as Culled, Sold, or Deceased are no longer shown in My Herd's default view.

**Active animal count:**
The count shown at the top of My Herd is your active animals only. This is the number of animals currently on your farm. Culled, sold, and deceased animals are tracked separately in the Records tab.

**My Herd starts minimized:**
When you open My Herd, the animal list may start collapsed into summary cards. Tap a card or use the expand button to see the full list.

**Filtering:**
You can filter by sex (rams, ewes, lambs), classification (stud, commercial), and status. Use the search bar to find animals by tag ID or name.

**Why might my count be different from farm records?**
Farm records include all animals ever recorded, including culled, sold, and deceased. My Herd shows only active animals. The Data tab reports on historical records including removed animals.

**Quick tip:**
If you cannot find an animal, check the Records tab → Culled, Sold, or Deceased sections. The animal may have been removed from active status.`,
    relatedAppArea: "animals",
    keywords: ["my herd", "active", "count", "animals", "filter", "status", "culled", "sold", "deceased"],
    suggestedQuestions: [
      "Why is my active animal count different from farm records?",
      "Why can't I see a sold animal in My Herd?",
      "How many active animals are on the farm?",
      "What does 'active' mean in BreedLog?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "add-edit-animals",
    title: "Adding and Editing Animals",
    category: "Animal Management",
    audience: "farmer",
    summary: "How to add new animals, edit existing records, and what information to capture.",
    body: `**Adding a new animal:**
1. Open My Herd.
2. Tap the "+ Add Animal" button.
3. Fill in the required fields: Tag ID, Sex, Date of Birth, and Classification.
4. Add optional fields: Dam (mother), Sire (father), Birth Weight, Source, Lambing Season, and Notes.
5. Tap "Save".

**Required fields:**
- Tag ID: The animal's unique ear tag number. Must be unique in your herd.
- Sex: Ram, Ewe, or Lamb.

**Recommended fields (improve analysis):**
- Date of Birth: Used for age and growth calculations.
- Sire: Links to the father ram for performance tracking.
- Dam: Links to the mother ewe for maternal performance.
- Birth Weight: Used for Average Daily Gain (ADG) calculations.
- Weaning Weight: Used for growth analysis.

**Editing an animal:**
1. Tap on the animal's card in My Herd.
2. Tap "Edit" on the animal detail page.
3. Change the fields you need.
4. Tap "Save".

**Photo upload:**
You can add photos to an animal's profile from the detail page. Photos are stored with the animal record.

**Data quality:**
BreedLog's Data tab works best when animals have birth dates, sire/dam links, and weights. The more complete your records, the better your analysis.`,
    relatedAppArea: "animals",
    keywords: ["add animal", "new animal", "edit", "tag ID", "birth date", "sire", "dam", "weight", "photo"],
    suggestedQuestions: [
      "How do I add a new animal?",
      "What information should I record for each animal?",
      "How do I add a sire to an animal?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "rams",
    title: "Rams / Sires",
    category: "Rams",
    audience: "farmer",
    summary: "Managing rams in BreedLog, including classification, breeding records, and performance tracking.",
    body: `**Adding a ram:**
Add a ram by going to My Herd → Add Animal, setting Sex to "Ram". You can classify as:
- Stud Ram: Top-performing registered ram.
- Breeding Ram: Active breeding ram.
- Commercial Ram: Commercial-grade ram.
- Ram Lamb: A male lamb not yet classified.

**Promoting a ram lamb:**
On the ram lamb's detail page, tap "Classify as Ram" to promote from lamb to ram and assign a ram type.

**Ram performance tracking:**
The Data tab → Ram/Sire Performance section shows each ram's progeny count and average birth/weaning weights. This helps identify which sires are producing the best offspring.

**Culling a ram:**
On the animal detail page, use "Confirm Cull" to mark a ram as culled. This removes it from My Herd but keeps its records in the Records tab.

**Best practice:**
Record each ram's Tag ID consistently and link offspring to their sire. This is essential for the Data tab's sire performance analysis.`,
    relatedAppArea: "animals",
    keywords: ["ram", "sire", "stud", "breeding ram", "commercial ram", "ram lamb", "classify", "cull", "performance"],
    suggestedQuestions: [
      "How do I add a ram?",
      "Which ram appears to be performing best?",
      "How do I promote a ram lamb to a ram?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "ewes",
    title: "Ewes / Dams",
    category: "Ewes",
    audience: "farmer",
    summary: "Managing ewes in BreedLog, including maternal performance tracking and lambing records.",
    body: `**Adding a ewe:**
Add a ewe by going to My Herd → Add Animal, setting Sex to "Ewe".

**Ewe classification:**
- Stud Ewe: Registered stud ewe.
- Commercial Ewe: Commercial-grade ewe.
- Ewe Lamb: Female lamb not yet classified.

**Promoting a ewe lamb:**
On the ewe lamb's detail page, tap "Move to Ewes" to reclassify from lamb to ewe.

**Maternal performance:**
The Data tab → Ewe Maternal Performance section shows:
- Ewes that have lambed vs barren ewes.
- Top performers (high lamb count and twin rate).
- Watchlist ewes (low weaning rates or poor performance).

**Lambing records:**
When a ewe lambs, record the lambing event in the Breeding section. This links the lamb to the dam and builds the performance record.

**Best practice:**
Link every lamb to its dam. This is the key data that drives the Ewe Maternal Performance analysis in the Data tab.`,
    relatedAppArea: "animals",
    keywords: ["ewe", "dam", "maternal", "lambing", "stud", "commercial", "ewe lamb", "performance", "barren"],
    suggestedQuestions: [
      "Which ewes look like top performers?",
      "Which ewes should be on my watchlist?",
      "How many ewes lambed vs how many are barren?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "lambs",
    title: "Lambs / Lamb Stages",
    category: "Lambs",
    audience: "farmer",
    summary: "Recording and managing lambs, including lamb stages, growth tracking, and classification.",
    body: `**Recording a lamb:**
Add a lamb by going to My Herd → Add Animal, setting Sex to "Lamb". Or record a birth directly from a Breeding Event (mating group lambing record).

**Lamb stages:**
BreedLog automatically calculates a lamb's stage based on its age and weight:
- Newborn: Just born, first days of life.
- Pre-weaning: Still with the ewe, before weaning.
- Weaning Age: Around weaning time.
- Post-weaning: After weaning, growing out.
- Grower: Older lamb, approaching market or classification age.

**Growth tracking:**
Record birth weight and weaning weight for each lamb. The Data tab → Lamb Growth section shows Average Daily Gain (ADG), single vs twin comparisons, and group growth performance.

**Classifying a lamb:**
When a lamb reaches the right age and weight, you can classify it:
- Tap the lamb's profile.
- Use "Classify as Ram Lamb" → "Classify as Ram" (males).
- Use "Move to Ewes" (females).

**Viewing lambs:**
Open the Lambs page from the navigation. This shows all animals recorded as lambs with their current stage and key metrics.`,
    relatedAppArea: "lambs",
    keywords: ["lamb", "lambs", "stages", "newborn", "weaning", "ADG", "growth", "classify", "birth weight"],
    suggestedQuestions: [
      "What are lamb stages?",
      "How do I record a lamb's weight?",
      "Compare my single-born vs twin-born lamb weights.",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "breeding",
    title: "Breeding Records",
    category: "Breeding",
    audience: "farmer",
    summary: "How to record breeding events (matings) between rams and ewes in BreedLog.",
    body: `**What is a breeding event?**
A breeding event records a mating between a specific ram and a specific ewe. This is the foundation of your breeding performance data.

**Recording a breeding event:**
1. Open the Breeding page.
2. Tap "+ New Breeding Event".
3. Select the ram (sire) and ewe (dam).
4. Enter the mating date.
5. Enter the expected lambing date (optional but helpful).
6. Select the mating group if applicable.
7. Save.

**Lambing results:**
When a ewe lambs, return to the breeding event and record:
- Number of lambs born.
- Whether the ewe lambed or was barren.
- Any notes.

**Viewing breeding events:**
All breeding events are listed on the Breeding page. You can filter by ram, ewe, mating group, season, and status.

**Breeding event exports:**
Export breeding event records as PDF or CSV from the Breeding page.`,
    relatedAppArea: "breeding",
    keywords: ["breeding", "mating", "breeding event", "ram", "ewe", "lambing", "sire", "dam", "season"],
    suggestedQuestions: [
      "How do I record a breeding event?",
      "How do I record a ewe lambing?",
      "How do I view my lambing results?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "mating-groups",
    title: "Mating Groups",
    category: "Mating Groups",
    audience: "farmer",
    summary: "How to create and manage mating groups to track which ewes are joined to which rams.",
    body: `**What is a mating group?**
A mating group is a group of ewes joined to a specific ram for a specific mating season. It allows you to track lambing results at the group level, not just individual events.

**Creating a mating group:**
1. Open the Breeding page.
2. Tap "Mating Groups".
3. Tap "+ New Mating Group".
4. Enter a group name or label.
5. Select the ram (sire) for the group.
6. Add the ewes in the group.
7. Enter the joining date and expected lambing date.
8. Save.

**Viewing mating group results:**
Open a mating group to see:
- All ewes in the group.
- Which ewes lambed and which were barren.
- Lambing rate for the group.
- Lambs per ewe joined and lambs per ewe lambed.
- The mating group's PDF export.

**Mating group exports:**
Export the mating group report as a PDF from the Mating Group detail page.

**How does this help?**
Mating groups make it easy to compare ram performance across different groups in the same season.`,
    relatedAppArea: "breeding",
    keywords: ["mating group", "joining", "season", "ewes joined", "lambing rate", "ram group", "group lambing"],
    suggestedQuestions: [
      "How do I create a mating group?",
      "What is my lambs-per-ewe result?",
      "Which breeding group performed best?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "productivity-logs",
    title: "Lambing and Productivity Logs",
    category: "Productivity",
    audience: "farmer",
    summary: "How to view and export lambing events and mating group productivity records.",
    body: `**What are productivity logs?**
Productivity logs are summaries of your lambing events and mating group results. They give you a record of what happened during each breeding season.

**Viewing productivity logs:**
Go to Records → Productivity Logs. This page has two tabs:
- Lambing Events: All recorded lambing events across all ewes.
- Mating Groups: Summary of each mating group's results.

**Exporting productivity logs:**
From the Productivity Logs page:
- Lambing Events: Export as PDF or CSV.
- Mating Groups: Export as PDF or CSV.

**Where are productivity exports saved?**
Productivity exports are automatically saved to Records → Exported Documents → Productivity folder. You can find all past productivity exports there.

**What does the lambing rate mean?**
Lambing rate = (lambs born ÷ ewes joined) × 100. For example, if 100 ewes were joined and 120 lambs were born, the lambing rate is 120%.

**Lambs per ewe joined vs lambs per ewe lambed:**
- Lambs per ewe joined: Total lambs born divided by total ewes joined (includes barren ewes).
- Lambs per ewe lambed: Total lambs born divided by only the ewes that actually lambed.`,
    relatedAppArea: "records",
    keywords: ["productivity", "lambing events", "mating groups", "lambing rate", "lambs per ewe", "export", "CSV", "PDF"],
    suggestedQuestions: [
      "Where are productivity exports saved?",
      "What is my recorded lambing rate?",
      "How do I export lambing events?",
      "What is my lambs-per-ewe result?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "health-records",
    title: "Health Records",
    category: "Health",
    audience: "farmer",
    summary: "How to record health events, treatments, and flock health records in BreedLog.",
    body: `**Individual health records:**
Record a health event for a specific animal from the animal's detail page → Health tab → Add Health Record. Fields include:
- Date.
- Type of event (treatment, vaccination, observation, etc.).
- Description / diagnosis notes.
- Treatment given.
- Follow-up required (yes/no and follow-up date).

**Flock health events:**
Record a health event that affects a group of animals (e.g., a farm-wide vaccination) from the Health page → New Flock Health Event. These apply to the whole flock or a group.

**Viewing health records:**
Open the Health page to see all flock health events. Individual animal health records are on each animal's detail page.

**Exporting health records:**
Export health records as PDF or CSV from the Health page. Health exports are automatically saved to Records → Exported Documents → Flock Health folder.

**Follow-up reminders:**
When you record a health event with a follow-up required, it will appear in your health watchlist.

**Important:**
BreedLog records health events as notes only. Always consult a qualified veterinarian for diagnosis and treatment decisions.`,
    relatedAppArea: "health",
    keywords: ["health", "treatment", "vaccination", "flock health", "follow-up", "diagnosis", "health records", "vet"],
    suggestedQuestions: [
      "How do I record a health event?",
      "What are my most common recorded treatments?",
      "Which animals have repeated health issues?",
      "Where are health record exports saved?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "weight-records",
    title: "Weight and Performance Records",
    category: "Weights",
    audience: "farmer",
    summary: "How to record and use weight records for growth analysis in BreedLog.",
    body: `**Recording weights:**
You can record weights at several points in an animal's life:
- Birth Weight: Enter when adding or editing an animal.
- Weaning Weight: Enter when the lamb is weaned.
- Current/Other Weights: Add from the animal's Performance Records tab.

**Performance records:**
On an animal's detail page, open the "Performance" tab to add performance records including weight measurements at different dates.

**Why weights matter:**
Weights are used to calculate Average Daily Gain (ADG) — the average grams gained per day. ADG is one of the most important indicators of lamb growth performance.

**Data tab analysis:**
The Data tab → Lamb Growth Performance section uses birth and weaning weights to show group growth comparisons, ADG, and single vs twin performance.

**Best practice:**
Record birth weights at birth and weaning weights at weaning for every lamb. Consistent weight recording gives you reliable growth data for selection decisions.

**Tip:**
If you have many records to enter, use the CSV import feature in Settings to bulk-import animals with their weights.`,
    relatedAppArea: "animals",
    keywords: ["weight", "birth weight", "weaning weight", "ADG", "average daily gain", "growth", "performance", "records"],
    suggestedQuestions: [
      "How do I record a weight?",
      "What is Average Daily Gain?",
      "How do I improve my growth data?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "records-tab",
    title: "Records Tab",
    category: "Records",
    audience: "farmer",
    summary: "What the Records tab contains, including culled/sold/deceased animals and productivity logs.",
    body: `**What is the Records tab?**
The Records tab is your historical archive. It keeps track of animals and events that are no longer in your active herd.

**Records tab sections:**
1. **Culled Animals**: Animals marked as culled (removed from the breeding programme). You can filter by sex, cull reason, date, and status.
2. **Sold/Removed Animals**: Animals that have been sold or removed from the farm. Filter by sex, reason, date, and status.
3. **Deceased Animals**: Animals that have died. Filter by sex, cause, date, and status.
4. **Productivity Logs**: Lambing event records and mating group summaries. Tabbed view: Lambing Events and Mating Groups.
5. **Exported Documents**: All PDF and CSV files you have exported from BreedLog, organized into folders.

**Exporting from Records:**
Each section has its own PDF and CSV export buttons. Exports are automatically saved to the Exported Documents section.

**Finding culled animals:**
Go to Records → Culled Animals. Use the filters (sex, cull reason, date range) to narrow down the list.

**Finding sold animals:**
Go to Records → Sold/Removed. Use the status and date filters to find records from a specific period.`,
    relatedAppArea: "records",
    keywords: ["records", "culled", "sold", "deceased", "productivity", "exported documents", "history", "archive", "filter"],
    suggestedQuestions: [
      "How do I find culled animals?",
      "How do I find sold animals from last month?",
      "Which animals were culled on a specific date?",
      "What does the Records tab contain?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "exported-documents",
    title: "Exported Documents",
    category: "Exported Documents",
    audience: "farmer",
    summary: "Where exported PDFs and CSVs are stored, how the folder system works, and how to find past exports.",
    body: `**What are Exported Documents?**
Every time you export a PDF or CSV from BreedLog, the file is automatically saved to the Exported Documents section in the Records tab.

**How are they organized?**
Exports are organized into 8 labelled folders:
1. **Herd Register** — Full herd list exports from My Herd.
2. **Individual Animal** — Exports of individual animal profiles.
3. **Culled Animals** — Culled animals export records.
4. **Sold/Removed** — Sold or removed animals export records.
5. **Deceased** — Deceased animals export records.
6. **Breeding/Mating** — Mating group and breeding event exports.
7. **Productivity** — Lambing event and productivity log exports.
8. **Flock Health** — Health event exports.

**Finding a past export:**
1. Go to Records → Exported Documents.
2. Tap the folder for the type of export you are looking for.
3. Use the search bar or date filters to find the specific export.
4. Tap the document to download or view it.

**How many exports are saved?**
BreedLog keeps a record of each export. There is no fixed limit. If the list gets long, use the date filter to find recent exports.

**Can I export JSON?**
No. BreedLog exports are PDF and CSV only. JSON export is not available through the standard export buttons. This is by design — PDF and CSV are easier to use with standard farm software and spreadsheets.`,
    relatedAppArea: "records",
    keywords: ["exported documents", "folders", "PDF", "CSV", "herd", "breeding", "health", "productivity", "download", "JSON"],
    suggestedQuestions: [
      "Where do exported health records go?",
      "Where are productivity exports saved?",
      "Can I export JSON?",
      "How do I find a past PDF export?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "exports",
    title: "PDF, CSV and Export Options",
    category: "Exports",
    audience: "farmer",
    summary: "What export formats are available, from which pages, and how they work.",
    body: `**Available export formats:**
BreedLog supports PDF and CSV exports. JSON export is not available.

**Where can I export from?**
- **My Herd (Animals page):** Export the full herd register as PDF or CSV.
- **Individual Animal:** Export a single animal's full profile and records as PDF.
- **Lambs page:** Export the lamb list as PDF or CSV.
- **Breeding page:** Export breeding event records as PDF or CSV.
- **Mating Group detail:** Export a specific mating group's report as PDF.
- **Health page:** Export health event records as PDF or CSV.
- **Records → Culled/Sold/Deceased:** Export filtered animal records as PDF or CSV.
- **Records → Productivity Logs:** Export lambing events and mating group summaries as PDF or CSV.

**PDF exports:**
PDF exports are formatted for printing and sharing. They use A4 paper, landscape for large tables, and are branded with BreedLog.

**CSV exports:**
CSV files can be opened in Excel, Google Sheets, or any spreadsheet app. They are useful for further analysis outside BreedLog.

**Where are exports saved?**
All exports are automatically logged in Records → Exported Documents, organized by category into 8 folders.

**XLSX (Excel) exports:**
XLSX export is currently not available due to dependency restrictions. Use CSV and open it in Excel.`,
    relatedAppArea: "exports",
    keywords: ["PDF", "CSV", "export", "download", "herd register", "Excel", "XLSX", "JSON", "print"],
    suggestedQuestions: [
      "How do I export a PDF?",
      "Can I export JSON?",
      "How do I export my full herd as a spreadsheet?",
      "What export formats does BreedLog support?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "data-tab",
    title: "Data Tab and Historical Farm Analysis",
    category: "Data & Analysis",
    audience: "farmer",
    summary: "What the Data tab shows, its 8 analysis sections, and how to use it for herd improvement decisions.",
    body: `**What is the Data tab?**
The Data tab (formerly called Analysis) is BreedLog's analytics centre. It gives you insights into your herd performance based on your recorded data.

**8 analysis sections:**
1. **Herd Distribution**: Breakdown of your herd by sex, classification, source, and status.
2. **Ram/Sire Performance**: Which rams are producing the most offspring and best growth results.
3. **Ewe Maternal Performance**: Which ewes are top performers and which are on the watchlist.
4. **Lamb Growth Performance**: ADG, birth/weaning weights, and single vs twin comparisons.
5. **Flock Improvement**: Trends in key performance metrics over time.
6. **Reproductive Efficiency**: Lambing rate, lambs per ewe joined, and lambs per ewe lambed.
7. **Health Overview**: Summary of health events, mortality, and survival rates.
8. **Data Quality**: How complete your records are and what data is missing.

**How to use the sections:**
Each section starts collapsed (showing a one-line summary). Tap to expand for the full analysis with charts, KPI tiles, and ranked lists.

**Filters:**
Use the filter bar at the top to filter by season, classification, and sex.

**Important note:**
The Data tab is only as good as your data. Incomplete records (missing weights, sire links, dates) will reduce the accuracy of the analysis. Check the Data Quality section to see what is missing.`,
    relatedAppArea: "analysis",
    keywords: ["data tab", "analysis", "herd distribution", "sire performance", "ewe performance", "lamb growth", "reproductive efficiency", "health overview", "data quality"],
    suggestedQuestions: [
      "What is the difference between My Herd and Data?",
      "Can I trust my current Data tab results?",
      "What should I record next to improve my analysis?",
      "How complete is my herd data?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "sync-offline",
    title: "Sync and Offline Use",
    category: "Sync",
    audience: "farmer",
    summary: "How BreedLog works offline, how syncing works, and what to do if sync gets stuck.",
    body: `**Offline first:**
BreedLog is designed to work without internet. All data is saved to your device first, then synced to the cloud when you have internet.

**How sync works:**
1. You record an animal, health event, breeding record, etc.
2. BreedLog saves it to your device immediately (IndexedDB).
3. When you have internet, BreedLog syncs the data to the cloud server.
4. The sync indicator in the top bar shows sync status.

**Offline grace period:**
BreedLog allows up to 7 days offline. After 7 days without an internet connection, you will be asked to connect to re-verify your access. Your data is not lost — it is still on your device.

**Manual sync:**
If you suspect data is not syncing, go to Settings → Data & Sync → tap "Sync Now". This forces an immediate sync attempt.

**Sync status indicator:**
Look for the sync status badge in the app header or sidebar. It shows:
- Synced: All data is up to date.
- Syncing: Currently syncing data.
- Pending: Data is waiting to sync (usually no internet).
- Error: A sync error occurred.

**Purging failed syncs:**
If the sync queue gets stuck with old failed records, go to Settings → Data & Sync → "Purge Failed Syncs". This clears records that have failed more than 3 times.

**Debug sync:**
In Settings → Data & Sync → "Debug Sync" shows you exactly what is in the sync queue. Useful for troubleshooting.

**What does "sync" mean?**
Sync means your local device data and the cloud server data are matched. When synced, your data is safe in the cloud and accessible from your other device.`,
    relatedAppArea: "sync",
    keywords: ["sync", "offline", "internet", "IndexedDB", "pending", "synced", "purge", "debug", "7 days", "grace period"],
    suggestedQuestions: [
      "What does sync mean?",
      "How does offline mode work?",
      "What do I do if sync is stuck?",
      "How long can I use BreedLog offline?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "settings",
    title: "Settings",
    category: "Settings",
    audience: "farmer",
    summary: "Overview of the Settings page, including farm name, theme, sync, import/export, and support tools.",
    body: `**Accessing Settings:**
Tap the Settings icon in the navigation (or open More → Settings on mobile).

**Farm information:**
In Settings → Farm Information, you can set your farm name and stud name. This appears on exported PDFs.

**Theme:**
Settings → Appearance lets you switch between Light, Dark, and System themes.

**Data & Sync:**
- Sync Now: Force a manual sync.
- Debug Sync: View the pending sync queue.
- Purge Failed Syncs: Clear stuck sync records.
- View Reload: Refresh data from the server.

**CSV Import:**
Import animals in bulk using a CSV file. Go to Settings → Import Data → CSV Import. Download the template, fill it in, and upload it.

**Export:**
You can also trigger exports from Settings, though most exports are easier from the specific page (e.g., export from Animals page or Health page).

**Report an Issue:**
Settings → Report Issue opens the field test issue reporting form. Use this to report bugs or problems during the field test.

**Help & Information:**
Settings → Help & Information opens the full in-app help documentation.

**Logout:**
Settings → Log Out clears your device access. You will need your access code to log back in. Your farm data remains safe in the cloud.`,
    relatedAppArea: "settings",
    keywords: ["settings", "farm name", "theme", "dark mode", "sync", "import", "CSV", "report issue", "logout", "help"],
    suggestedQuestions: [
      "How do I change the theme?",
      "How do I import animals by CSV?",
      "How do I report a bug?",
      "How do I sync my data?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "issue-reporting",
    title: "Reporting an Issue",
    category: "Issue Reporting",
    audience: "all",
    summary: "How to report a bug or problem during the BreedLog field test.",
    body: `**Why report issues?**
BreedLog is in final field testing. Your feedback is essential. Reporting bugs and problems helps the BreedLog team improve the app before full release.

**How to report an issue:**
1. Go to Settings → Report Issue, or Help → Report an Issue.
2. Fill in the form:
   - Issue title (short, clear description).
   - Description (what happened, what you expected).
   - Area of app (e.g., My Herd, Sync, Breeding).
   - Severity (Low / Medium / High / Blocking).
   - Device type (Phone / Tablet / Desktop).
3. Tap "Submit Issue".
4. You will see a confirmation that your report was received.

**What happens next:**
The BreedLog admin team receives your report and will review it. You can track the status of reported issues if you have admin access.

**Severity guide:**
- Low: Minor cosmetic issue or small inconvenience. App still works.
- Medium: A feature is not working correctly but you can still use the app.
- High: A significant feature is broken or data is incorrect.
- Blocking: App will not open, data loss, or cannot complete essential tasks.

**Screenshots:**
If you have a screenshot of the problem, note the page and time so the team can find it in the logs.`,
    relatedAppArea: "settings",
    keywords: ["report issue", "bug", "feedback", "field test", "submit", "severity", "screenshot"],
    suggestedQuestions: [
      "How do I report a bug?",
      "How do I report an issue?",
      "What must I test during the final field test?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "field-testing",
    title: "Field Testing Guide",
    category: "Field Testing",
    audience: "farmer",
    summary: "What to test during the BreedLog field test and how to provide useful feedback.",
    body: `**You are a field tester — thank you!**
This is the final real-world test of BreedLog before it is released. Your job is to use the app as you normally would on your farm and report any problems you find.

**What to test:**

1. **Installation**: Install BreedLog as a phone app AND on your desktop. Test both.
2. **Access code**: Enter your code, check it saves, and try logging out and back in.
3. **Adding animals**: Add at least 5 animals with full details (tag, sex, DOB, sire, dam, weights).
4. **Editing animals**: Edit an existing animal's details.
5. **Recording health events**: Add a health record to an animal and a flock health event.
6. **Recording weights**: Add birth weights and weaning weights.
7. **Breeding records**: Create a mating group and add at least one breeding event.
8. **Lambing results**: Record lambing results on a breeding event.
9. **Exporting**: Export your herd list as PDF and CSV. Check they download correctly.
10. **Records tab**: Check the Culled, Sold, Deceased, Productivity, and Exported Documents sections.
11. **Data tab**: Open the Data tab and check that your recorded data appears in the analysis.
12. **Offline mode**: Turn off your internet (airplane mode) and try adding an animal. Then reconnect and check it syncs.
13. **Ask BreedLog**: Ask the AI assistant questions about your farm data and about the app.
14. **Report an Issue**: Use the Report Issue form to submit at least one test report.

**What makes a good bug report:**
- Exactly what you did (the steps).
- What you expected to happen.
- What actually happened.
- Your device type and whether you are using the installed app or a browser tab.

**Contact:**
If something is very wrong and you cannot use the report form, contact the BreedLog team directly.`,
    relatedAppArea: "all",
    keywords: ["field test", "testing", "beta", "feedback", "test guide", "what to test", "bug report"],
    suggestedQuestions: [
      "What must I test during the final field test?",
      "How do I report a bug?",
      "What makes a good bug report?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting Common Problems",
    category: "Troubleshooting",
    audience: "all",
    summary: "Solutions to common problems in BreedLog including sync issues, login problems, and data not showing.",
    body: `**App won't load or is blank:**
- Hard-refresh the page (Ctrl+Shift+R on desktop, or close and reopen the installed app).
- Check your internet connection.
- If on desktop, try clearing the browser cache.

**Access code not working:**
- Make sure you are typing the code in CAPITALS.
- Check for typos — codes are case-sensitive.
- Confirm your code has not been revoked by the admin.
- Contact the BreedLog team if the code was correct and still fails.

**Data not syncing:**
- Check your internet connection.
- Go to Settings → Data & Sync → Sync Now.
- If records are stuck, try Settings → Data & Sync → Purge Failed Syncs.
- If problems continue, use Debug Sync to see what is queued.

**Animal not appearing in My Herd:**
- The animal may have been culled, sold, or marked as deceased. Check Records tab.
- Try the search bar to find it by tag ID.
- If you just added it offline, check that sync has completed.

**Can't see expected data in the Data tab:**
- Check that animals have dates, sire/dam links, and weights recorded.
- Open the Data Quality section — it shows what is missing.
- Data tab uses historical records — animals must be recorded first.

**PDF export not downloading:**
- Check your browser allows downloads from this site.
- On iPhone, PDFs may open in a preview. Tap Share to save.
- Make sure you have free storage space on your device.

**Lost your access code:**
- BreedLog cannot recover your code — it is provided by the field test team.
- Contact the BreedLog team for a new or replacement code.

**App is slow:**
- On first load, BreedLog may take a moment to cache resources.
- After the first load, it should be much faster, especially offline.`,
    relatedAppArea: "all",
    keywords: ["troubleshoot", "problems", "sync", "blank", "code", "not loading", "missing data", "PDF", "slow", "lost code"],
    suggestedQuestions: [
      "Why is my data not syncing?",
      "Why can't I find an animal?",
      "My access code is not working — what do I do?",
      "Why is the Data tab not showing my records?",
    ],
    lastUpdated: "2026-06-01",
  },
  {
    id: "faq",
    title: "Frequently Asked Questions (FAQ)",
    category: "FAQ",
    audience: "all",
    summary: "Answers to the most commonly asked questions about BreedLog.",
    body: `**Q: What is BreedLog?**
A: BreedLog is a livestock management app for Meatmaster sheep farmers. It helps you record, track, and analyse your herd's performance — online and offline.

**Q: Does BreedLog require the internet?**
A: No. BreedLog works offline. You can record data without internet and it will sync when you reconnect. You need internet once every 7 days to verify your access.

**Q: Is my data safe?**
A: Yes. Your data is stored on your device and synced to a secure cloud server. It is not shared with other users or third parties.

**Q: Can I use BreedLog on multiple devices?**
A: Yes. Each invite code supports one desktop slot and one phone/tablet slot. Your data syncs between both devices.

**Q: Can I export my data?**
A: Yes. BreedLog exports PDF and CSV files. JSON export is not supported. Exports are saved to Records → Exported Documents.

**Q: Why can't I see a sold animal in My Herd?**
A: Sold/removed animals are moved out of My Herd. Go to Records → Sold/Removed to find them.

**Q: What is the difference between My Herd and Data?**
A: My Herd shows your current active animals. The Data tab shows historical performance analysis across all your records, including removed animals.

**Q: How do I add a ram?**
A: Go to My Herd → Add Animal → set Sex to "Ram" and choose a ram classification.

**Q: How do I record a ewe lambing?**
A: Record a breeding event between the ram and ewe, then update the breeding event with the lambing result (lambs born, date).

**Q: What does the sync indicator mean?**
A: It shows whether your device data matches the cloud. "Synced" means all good. "Pending" means records are waiting to sync. "Error" means something went wrong — try syncing manually in Settings.

**Q: Who made BreedLog?**
A: BreedLog is developed by STITCH WORX — Software, systems & digital builds.`,
    relatedAppArea: "all",
    keywords: ["FAQ", "frequently asked questions", "internet", "offline", "multiple devices", "export", "sold", "ram", "ewe", "lambing", "sync"],
    suggestedQuestions: [
      "Does BreedLog work without internet?",
      "Is my data safe?",
      "What is the difference between My Herd and Data?",
    ],
    lastUpdated: "2026-06-01",
  },
];

export function searchKnowledge(query: string): KnowledgeEntry[] {
  const q = query.toLowerCase();
  return KNOWLEDGE_BASE.filter((entry) => {
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.summary.toLowerCase().includes(q) ||
      entry.body.toLowerCase().includes(q) ||
      entry.keywords.some((k) => k.toLowerCase().includes(q)) ||
      entry.category.toLowerCase().includes(q)
    );
  });
}

export function getKnowledgeById(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE_BASE.find((e) => e.id === id);
}

export function getKnowledgeByCategory(category: string): KnowledgeEntry[] {
  return KNOWLEDGE_BASE.filter((e) => e.category === category);
}

export const KNOWLEDGE_CATEGORIES = [...new Set(KNOWLEDGE_BASE.map((e) => e.category))];

export function buildKnowledgeContextString(): string {
  return KNOWLEDGE_BASE.map(
    (e) =>
      `=== ${e.title} ===\nCategory: ${e.category}\nSummary: ${e.summary}\n\n${e.body}\n`
  ).join("\n\n");
}
