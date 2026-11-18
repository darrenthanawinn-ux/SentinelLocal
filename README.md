# SentinelLocal

**Autonomous Dark-Hours Conversion & Margin Sentinel for Local DFW Businesses**

SentinelLocal is a zero-friction, autonomous back-office engine built for **CodeForDFW**. It plugs directly into the SMS, email, and spreadsheet workflows local businesses already rely on—capturing after-hours leads, preventing margin leaks from unverified quotes or supplier cost hikes, and executing routine bookings automatically without requiring staff retraining.

---

## The Problem
Local service and retail businesses lose 30%–50% of recoverable revenue due to operational friction:
* **Dark-Hours Lead Decay:** Customer texts, web forms, and quote requests sent after 5:00 PM sit unanswered until the next morning, by which time customers have already booked with faster competitors.
* **Off-the-Cuff Margin Leaks:** Staff give rapid verbal or SMS quotes without checking live supplier costs, rush fees, or minimum gross margin floors, resulting in jobs completed at razor-thin or negative margins.
* **Software Adoption Friction:** Busy business owners and field technicians reject complex dashboards that require weeks of training.

## The Solution
SentinelLocal operates quietly behind existing communication channels with a high-contrast executive command center for exception handling:
1. **Omni-Channel Ingestion & Entity Extraction (`/api/ingest`):** Parses unstructured incoming customer SMS messages, discount requests, and supplier cost updates into structured JSON entities.
2. **Deterministic Margin & Catalog Guard:** Cross-references every quote against live SKU base costs, retail prices, and minimum gross margin thresholds—eliminating AI pricing hallucinations.
3. **Autonomous Self-Closing Loop:** Automatically calculates quotes, locks slots, and dispatches confirmation replies in seconds whenever a request meets business rules.
4. **Human-in-the-Loop 1-Click Guardrail Queue (`/api/approve`):** Flags steep discount demands, weekend rush requests, or supplier cost spikes with clear rule reasoning and an editable counter-offer ready for 1-click owner approval.
5. **Live ROI Telemetry & Business Brain:** Tracks recovered after-hours revenue, prevented margin leaks, and admin hours saved in real time, alongside an editable catalog where cost changes immediately update live quoting rules.

---

## Tech Stack
* **Framework:** Next.js 14 (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Icons:** Lucide React
* **Architecture:** Modular REST API routes (`/api/ingest`, `/api/approve`) backed by a stateful, deterministic rule engine (`lib/store.ts`)

---
