# Skill: BreedLog One-Page Family Tree Pedigree Integration

## Purpose

Upgrade BreedLog animal performance datasheet exports so the family tree/pedigree is shown properly inside the main one-page animal document.

The current weak pedigree layout must be replaced with a professional linked family-tree panel that shows the subject animal, sire, dam, and grandparent placeholders or real ancestor records where available.

The family tree must be visible in the on-screen document preview and in the exported PDF/image. The user must not need to open a separate pedigree page just to see the lineage.

## Required Result

The individual animal performance datasheet must become one complete, professional, A4-safe document that includes:

1. Header and farm branding.
2. Animal photo and identity block.
3. Animal details table.
4. Rating/strength banner.
5. Growth performance table.
6. Progeny and breeding table.
7. Performance summary.
8. Full linked family-tree pedigree panel.
9. Footer branding.

The pedigree panel must appear below the performance summary and above the footer.

## Family Tree Layout

The family tree must follow this structure:

Subject Animal → Sire and Dam → Grandparents

The subject animal must appear on the left.

The Sire and Dam cards must appear in the middle.

The four grandparent cards must appear on the right.

Required grandparent positions:

- Sire’s Father
- Sire’s Mother
- Dam’s Father
- Dam’s Mother

The layout must use clear connector lines so the family relationship is visually obvious.

## Visual Design Rules

Use the attached dark bloodline/family-tree image only as a structure reference, not as the final export background.

The exported datasheet must not use a black background for the pedigree area.

Use a light professional document background:

- White
- Off-white
- Light grey
- Pale blue-grey

Use gold or amber connector lines.

Use a clean livestock-report style with strong alignment, rounded cards, subtle borders, and readable print-safe text.

Suggested styling:

- Subject card: gold accent
- Sire side: blue accent
- Dam side: rose/pink accent
- Known animals: solid border
- Unknown animals: dashed border
- Light panel background
- Connector lines: gold/amber
- Typography: clean, bold headings, readable body text

Do not make the pedigree look playful, childish, cartoon-like, or decorative. It must look like a serious breeding and livestock performance record.

## Subject Animal Card

The subject animal card must include:

- Animal photo thumbnail if available
- Animal ID as the most prominent text
- Sex
- Breed
- Date of birth

Example content:

```text
KW22002
RAM | Meatmaster
16/01/2022
```

If the photo is missing, use a neutral livestock placeholder icon.

## Parent Cards

The Sire and Dam cards must be larger than the grandparent cards.

Sire card must show:

```text
SIRE
Animal ID or Unknown
```

Dam card must show:

```text
DAM
Animal ID or Unknown
```

If parent data exists, show the real animal data.

If parent data is missing, show Unknown.

Do not show blank cards.

Do not show null, undefined, [object Object], or broken image icons.

## Grandparent Cards

The four grandparent cards must always render.

If data is missing, show these placeholders:

```text
GP Sire
Sire's Father
Unknown
```

```text
GP Dam
Sire's Mother
Unknown
```

```text
GP Sire
Dam's Father
Unknown
```

```text
GP Dam
Dam's Mother
Unknown
```

If real grandparent data exists, replace Unknown with the actual animal ID or name.

Grandparent cards must be smaller than the Sire and Dam cards but still readable when printed on A4.

## Connector Line Rules

The family tree must be physically linked with visible lines.

Required connector logic:

- Subject connects to a vertical branch.
- The vertical branch splits to Sire and Dam.
- Sire connects to Sire’s Father and Sire’s Mother.
- Dam connects to Dam’s Father and Dam’s Mother.

Connector lines must not overlap text, photos, icons, or card borders in a messy way.

Connector lines must not be clipped in PDF, image export, or print preview.

## Data Handling

The pedigree renderer must accept a structured lineage object.

Expected data shape:

```ts
type PedigreeAnimal = {
  id?: string;
  name?: string;
  sex?: string;
  breed?: string;
  dateOfBirth?: string;
  photoUrl?: string;
  status?: string;
  classification?: string;
};

type PedigreeTree = {
  subject: PedigreeAnimal;
  sire?: PedigreeAnimal;
  dam?: PedigreeAnimal;
  sireSire?: PedigreeAnimal;
  sireDam?: PedigreeAnimal;
  damSire?: PedigreeAnimal;
  damDam?: PedigreeAnimal;
};
```

Fallback rules:

- Missing subject photo: show neutral livestock placeholder.
- Missing parent: show Unknown.
- Missing grandparent: show correct GP label and Unknown.
- Missing DOB: omit DOB line.
- Missing breed: omit breed line.
- Missing ID: show Unknown.
- Never print null.
- Never print undefined.
- Never print [object Object].
- Never show broken image icons.

## Export Requirements

The upgraded family tree must work in:

- On-screen preview
- PDF export
- Image export
- Print preview

The on-screen preview must match the exported result.

The user must be able to view the pedigree before exporting.

## A4 Print Safety

The document must remain A4-safe.

Required:

- No content may overflow the page width.
- No pedigree cards may be clipped.
- No connector lines may be clipped.
- Footer must remain visible.
- Text must remain readable.
- The page must not have large wasted white space.
- The pedigree must fit cleanly below the performance summary.

If there is too much content, reduce spacing and compact the tables before removing the pedigree.

Do not remove the pedigree from page one.

## One-Page Rule

The preferred result is one complete page.

If the data becomes too dense, page one must still include a compact family-tree preview. A full expanded pedigree may continue on page two only when absolutely necessary.

The first page must never return to only two simple SIRE and DAM boxes.

## Visual Acceptance Gate

Before claiming completion, produce proof showing:

1. On-screen preview with the full linked family tree visible.
2. Exported PDF with the full linked family tree visible.
3. Exported image with the full linked family tree visible.
4. Unknown parent and grandparent fallback test.
5. Known parent and grandparent test if sample data exists.
6. A4 fit check with no clipping, no overflow, and readable footer.

If these proofs are not produced, the work is not complete.

## Non-Negotiables

Do not remove the performance tables.

Do not move the family tree to a separate-only page.

Do not leave the first-page pedigree as only SIRE and DAM boxes.

Do not use a black pedigree background in exported reports.

Do not break BreedLog branding.

Do not break farm branding.

Do not break animal photo rendering.

Do not break the footer.

Do not claim completion without visual export proof.

## Branding

Keep BreedLog and farm branding as the primary branding.

Where a creator/developer credit is suitable, use this subtly:

```text
Developed by STITCH WORX — Software, systems & digital builds.
```

This must not replace BreedLog, Kwantam Meatmasters, farm branding, or animal-owner branding.
