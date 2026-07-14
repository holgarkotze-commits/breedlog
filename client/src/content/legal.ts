export type LegalDocumentKey =
  | "privacy"
  | "terms"
  | "subscription"
  | "account-deletion";

export type LegalDocumentSection = {
  heading: string;
  body: string[];
};

export type LegalDocument = {
  key: LegalDocumentKey;
  title: string;
  subtitle: string;
  reviewStatus: string;
  lastUpdated: string;
  sections: LegalDocumentSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    key: "privacy",
    title: "Privacy Policy",
    subtitle: "How BreedLog handles account, herd, backup, export, and support data.",
    reviewStatus: "Draft for professional legal review before production activation.",
    lastUpdated: "2026-07-13",
    sections: [
      {
        heading: "What BreedLog Stores",
        body: [
          "BreedLog stores account identity, device registration records, farm profile details, animal records, parentage, mating, lambing, health, weight, performance, genetics, documents, images, export history, backup metadata, subscription state, support requests, and audit events needed to operate the service.",
          "Workspace data is scoped to the authenticated account. Ordinary commercial accounts must not receive Haka's controlled U2A2ZAVQ Kwantam simulation workspace.",
        ],
      },
      {
        heading: "How Data Is Used",
        body: [
          "BreedLog uses stored data to provide herd management, synchronization, exports, AI-assisted summaries, backups, support diagnostics, and account security controls.",
          "Structured logs and operational telemetry must be redacted and must not expose secrets, payment credentials, or private herd records.",
        ],
      },
      {
        heading: "Backups, Exports, and Retention",
        body: [
          "Encrypted .breedlogbackup files are account-bound. Corrupted backups and backups bound to another account are rejected before restore.",
          "Users remain responsible for storing exported backup files safely once they are downloaded outside BreedLog-controlled systems.",
        ],
      },
    ],
  },
  terms: {
    key: "terms",
    title: "Terms of Service",
    subtitle: "Core service terms for using BreedLog.",
    reviewStatus: "Draft for professional legal review before production activation.",
    lastUpdated: "2026-07-13",
    sections: [
      {
        heading: "Service Scope",
        body: [
          "BreedLog provides livestock record keeping, performance reporting, exports, backups, and optional AI-assisted analysis for herd management.",
          "The product is designed to support farm operations, not to replace veterinary, legal, tax, financial, or other regulated professional advice.",
        ],
      },
      {
        heading: "User Responsibilities",
        body: [
          "Users are responsible for lawful use, accurate data entry, safe backup storage, device and account security, and independent verification of management decisions.",
          "Users must not attempt to access another account's workspace, restore another account's backup, or use administrative or test-only credentials without authorization.",
        ],
      },
      {
        heading: "Availability and Changes",
        body: [
          "BreedLog may change features, limits, and operational processes only through documented product and release governance.",
          "Locked commercial rules, workspace isolation rules, and data-protection controls are governed by backend-authoritative enforcement and release review.",
        ],
      },
    ],
  },
  subscription: {
    key: "subscription",
    title: "Subscription Terms",
    subtitle: "Locked Free and Premium plan rules for BreedLog.",
    reviewStatus: "Draft for professional legal and tax review before production activation.",
    lastUpdated: "2026-07-13",
    sections: [
      {
        heading: "Plans and Pricing",
        body: [
          "BreedLog has exactly two plans: Free and Premium. Free is limited to 30 active animals, 5 individual PDF exports per month, 10 AI actions per month, 1 active device, one manual backup in a rolling seven-day window, and retention of the latest 4 weekly automatic backups.",
          "Premium is priced at N$149 monthly or N$1,520 yearly, with unlimited animals, up to 3 active devices, AI fair-use controls, up to 1,000 individual PDFs per month, 50 batch PDFs per month, optional quota add-ons, retention of the latest 12 weekly automatic backups, and unlimited manual backups.",
        ],
      },
      {
        heading: "Billing Authority",
        body: [
          "Backend entitlement state is authoritative. Premium must not activate from client-side state alone or from an unverified checkout return.",
          "Cancellation, grace-period, failed-payment, refund, dispute, and reversal handling must be driven by signed provider webhooks and idempotent billing events.",
        ],
      },
      {
        heading: "Downgrade and Restoration",
        body: [
          "Downgrading from Premium to Free must preserve all data. Only the first 30 originally added active animals remain visible while later active animals are hidden without deletion.",
          "Premium reactivation must restore the exact retained workspace without reordering visible animals or destroying records, lineage, or relationships.",
        ],
      },
    ],
  },
  "account-deletion": {
    key: "account-deletion",
    title: "Account Deletion Policy",
    subtitle: "How BreedLog handles requested deletion and the recovery window.",
    reviewStatus: "Draft for professional legal review before production activation.",
    lastUpdated: "2026-07-13",
    sections: [
      {
        heading: "Deletion Request Flow",
        body: [
          "Account deletion requires authenticated intent, exact typed confirmation, and an optional export-before-deletion backup step.",
          "BreedLog places the account into a 30-day recovery window before permanent deletion is completed.",
        ],
      },
      {
        heading: "Recovery and Cancellation",
        body: [
          "A pending deletion can be cancelled during the recovery window. Cancellation must preserve workspace data and stop the permanent-delete transition.",
          "Permanent deletion must only complete after the recovery window expires and must record an audit reference for the deletion event.",
        ],
      },
      {
        heading: "What Permanent Deletion Removes",
        body: [
          "Permanent deletion is intended to remove animals, records, documents, images, exports, backups under BreedLog control, sessions, and support-linked account identifiers where legally permissible.",
          "This policy is subject to legal-retention duties and professional review before public production activation.",
        ],
      },
    ],
  },
};
