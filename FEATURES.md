# RV Valuations - Features, Requirements, and Conditions

This file is the source of truth for product behavior.

When any feature is added or changed:
1. Update this document in the same change.
2. Verify the affected checklist items before closing the task.
3. Do not merge behavior that contradicts this file.

## 1) Core Priority Rules (Global)
- Field source hierarchy is strict:
  - `manual` (highest priority)
  - `pdf`
  - `api` (lowest priority)
- API can overwrite a value only when:
  - field is empty, or
  - field equals default value, or
  - field equals previous API value (API-over-API allowed).
- Manual/PDF values must never be silently overwritten by API.

## 2) Discrepancy Rules
- `pdf_values` always stores extracted PDF values.
- `api_values` always stores latest API snapshot values.
- API snapshot values must be stored even when the field is not overwritten (to preserve discrepancy visibility).
- Labels show:
  - `PDF discrepancy` when current value differs from `pdf_values[field]`.
  - `API discrepancy` when current value differs from `api_values[field]`.
- Discrepancy behavior must remain stable across timeout/retry paths.

## 3) APN / Parcel Normalization Rules
- Any parcel/APN value from PDF, manual, or API must be normalized before storing:
  - trim edges
  - remove internal spaces
  - remove dashes (`-`)
- Applies to both:
  - `parcel_1`
  - `parcelNumber`
- Aliases must stay synchronized (`parcel_1` and `parcelNumber` represent same normalized value).

## 4) Step 1 (Location & Details)
- Address can come from manual entry or PDF extraction.
- If address exists and `lat/lng` are missing, geocode must run and map preview must render.
- Geocode/derived fields (`city/state/county/zip/fips`) follow global priority rules.
- PDF fallback can fill empty/default fields for:
  - owner name
  - parcel/APN
  - acreage
  - property type
  - year built
  - last sale price
- AI Auto-Fill in Step 1 uses selected provider from sidebar toggle.

## 5) Upload + PDF Analysis
- Supported formats: `.csv`, `.xls`, `.xlsx`, `.pdf`.
- Timeout for analysis network operations is `120s`.
- Timeout applies to:
  - storage upload
  - analyze-url request
  - direct analyze fallback
- Timeout does not interrupt local merge lifecycle.
- On upload error (including timeout), error message stays visible until:
  - user uploads a new file, or
  - user clicks `Continue Manually`.
- On success, upload card auto-resets.

## 6) API Provider Selection
- Sidebar provides exclusive provider toggles:
  - Melissa
  - ATTOM
  - Rentcast
  - ReportAllUSA
- Exactly one provider is active at a time.
- Autofill must use only the selected provider for that action.

## 7) Taxes (Step 5)
- Taxes Auto-Fill uses selected provider and existing APN.
- APN is required for taxes autofill.
- FRED 10Y treasury is attempted independently for taxes flow.
- Provider tax failure must not erase existing manual/PDF values.

## 8) Google Sheets Sync
- Web -> Sheet:
  - debounced sync on mapped fields
  - step transitions flush pending sync
- Sheet -> Web:
  - load endpoint hydrates inputs/defaults/outputs
- Critical non-sheet state (`pdf_values`, `api_values`, grouped P&L metadata) must remain local app state and not be accidentally discarded.

## 9) Step Transition to Results
- Before moving from Taxes to Results, objective-search script execution is required.
- If script fails, transition should be blocked and user informed.

## 10) Results View
- Download Report supports:
  - Excel export
  - Google Sheets copy/open flow
- Share button is removed.

## 11) Definition of Done for Any New Change
- Update this `FEATURES.md` if behavior changed.
- Run build and confirm no regression in affected steps.
- Re-check these critical invariants:
  - Manual/PDF/API hierarchy preserved.
  - APN normalization preserved.
  - Discrepancy labels still accurate.
  - Map still appears when PDF provides address.
  - Timeout/error UX behavior unchanged unless explicitly requested.

## Regression Checklist (Run on Every Change)
- [ ] PDF upload fills fields without overriding manual data.
- [ ] `pdf_values` and `api_values` are both preserved after autofill.
- [ ] Parcel/APN is normalized (trim + no spaces + no dashes).
- [ ] `parcel_1` and `parcelNumber` remain synchronized.
- [ ] Address from PDF triggers geocode/map when `lat/lng` are missing.
- [ ] API autofill does not replace manual/PDF values.
- [ ] API discrepancy labels still render when values differ.
- [ ] Timeout message behavior matches spec (persists on error).
- [ ] Next button blocking rules still work during busy states.
- [ ] `npm run build` passes.
