# BreedLog Performance Intelligence — Version 1

This document describes the deterministic analysis layer implemented in the app.

## Scope

Route: `/analysis`

Modules:
- Flock Overview
- Growth Analysis
- Ewe Maternal Performance
- Ram / Sire Performance
- Lamb Survival
- Fertility & Reproduction
- Selection Candidates
- Pedigree / Inbreeding Risk
- Data Quality

## Data Sources

The analysis uses internal app records only:
- animals
- breeding events
- performance records
- health records

No external AI provider, model, prompt, or API key is used.

## Confidence Levels

- **Low**: sparse linkage or missing key fields
- **Medium**: partial records, important gaps remain
- **High**: linked records are sufficient for useful comparison
- **Proven**: high completeness with repeated outcomes / sufficient depth

## Core Formulas (Version 1)

### ADG
`ADG = (endWeight - startWeight) / daysBetween`

Guards:
- returns null if missing weights
- returns null if missing dates
- returns null if non-positive day span

### Maternal Index
Weighted components:
- lambing consistency: 15
- lambs born alive: 15
- lamb survival: 20
- lambs weaned: 20
- lamb growth to weaning: 15
- lambing ease: 5
- mothering issues: 5
- repeated performance: 5

### Sire Impact Score
Weighted components:
- progeny count: 20
- progeny survival: 20
- progeny growth: 25
- progeny consistency across dams: 15
- lambs weaned: 10
- confidence contribution: 10

## Rule-Based Explanations

Reason text is deterministic and generated from metric thresholds and record coverage.  
Examples include:
- performance strengths
- missing data impacts
- confidence statements

## Data Quality Behavior

Missing information is explicitly reported (e.g. sire/dam links, weaning weights).  
The module includes a completeness score and practical data-capture guidance.

## Current Limitations

- No genomic analysis
- No EBV / breed society evaluation
- Survival checkpoint granularity is limited by current schema (day-level checkpoints are not yet a dedicated table)
- Comparison grouping is basic in Version 1 and should be expanded in Version 2
