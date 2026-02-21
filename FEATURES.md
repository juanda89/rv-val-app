# RV Valuations - Feature Baseline

This file is the regression baseline.  
When a new feature is added or behavior changes, update this file first.

## 1) Auth and Navigation
- Google auth login redirects to valuations dashboard.
- `/projects/create` supports:
  - New valuation flow.
  - Edit flow via `?projectId=...`.
- Shared report view works read-only.

## 2) Project Creation and Google Sheet
- New project is created by calling webhook to duplicate master sheet.
- The duplicated file id is stored as `projects.spreadsheet_id` in Supabase.
- After sheet creation:
  - `Input Fields` column `D` (Default Values) is copied into column `C` only where `C` is empty.
  - Column `B` labels are not rewritten by app logic.

## 3) Input Defaults Behavior
- In UI, inputs use values loaded from sheet column `C`.
- If a field in `C` is empty and a default exists in `D`, default is shown as initial value.
- Defaults are provided to frontend as `default_values`.

## 4) Data Source Priority (Step 1)
- Address is geocoded with Google Maps.
- `city`, `state`, `county`, `zip_code`, `lat`, `lng` come from Google Maps (or manual user edit).
- ATTOM enriches property fields (apn, acreage, property_type, year_built, last_sale_price, taxes, demographics, etc.).
- ATTOM request cadence:
  1. Geo snapshot by `lat/lng` first.
  2. Parcel+FIPS (`expandedprofile`) when APN/FIPS available.
  3. Address (`basicprofile`), then normalized address fallback.
  4. Detail by `attomid`.
  5. Expanded profile by address.
  6. Community demographics by `geoIdV4` (or lookup fallback).
- If ATTOM has no result, PDF values can fill empty fields.

## 5) PDF vs API Fill Rules
- Uploaded file extracts fields into `pdf_values`.
- If field is empty/default, PDF can fill it.
- API/AI values should not overwrite user-entered non-default values.
- Discrepancy tags:
  - `PDF discrepancy: ...` when current value differs from PDF value.
  - `API discrepancy: ...` when current value differs from API value.
- Parcel comparison ignores spaces and dashes for matching.

## 6) Sync Model (Google Sheets <-> Web)
- Web -> Sheet:
  - Debounced sync of mapped input fields (`/api/sheet/sync`).
  - Step `Next` enforces a flush sync before advancing.
  - P&L has explicit sync endpoints for original/grouped rows.
- Sheet -> Web:
  - On edit-load (`/api/sheet/load`) app hydrates:
    - Inputs, defaults, outputs, P&L original/grouped rows.
  - Results can be refreshed from sheet on demand.
- Label-based output loading reads `Output Fields!B:C` to support fields not hardcoded in mapping.

## 7) P&L (Step 3)
- Users can add original Income and Expense rows manually.
- AI grouping creates grouped categories and assignments.
- Grouping gate:
  - Must match totals (original vs grouped) to enable Next.
  - Visual status indicates match/non-match.
- UI names:
  - "Original" renamed to "Historical".
- Delete action uses trash icon.

## 8) Taxes (Step 5)
- `Full Whammy Tax Bump?` is Yes/No toggle.
- `Year 1 Tax Increase` only visible when Full Whammy = `No`.
- `Year 1 Tax Increase` is percentage semantics:
  - User input `7` means `7%`.

## 9) Results Dashboard
- Real Estate Valuation card is editable and includes slider.
- Summary cards include icons and formatting.
- Income & Expenses Comparison table includes:
  - Historical T-12, RR, RE, Per Lot.
  - Negative values shown in red.
- Rent/NOI/Taxes chart:
  - Uses year 0-5.
  - Year 0 uses Historical T-12 totals.
  - Hover tooltip displays value per segment.
- Share + Download:
  - Download exports Google Sheet as Excel.

## 10) Known Contracts
- `owner_name` must be available in Step 1 and should be populated from ATTOM when present.
- Output label scan must cover large templates (`B2:C2000`) so rows are not truncated.
- ATTOM multi-endpoint merges must preserve non-empty owner/identifier/address data (later null values cannot erase previous valid values).
- Output label duplicates cannot overwrite a non-empty value with an empty duplicate row.

## Regression Checklist
- [ ] New project copies defaults D -> C without writing B labels.
- [ ] Edit existing valuation loads inputs from sheet (not blank).
- [ ] Owner name is populated from ATTOM when ATTOM has owner info.
- [ ] Discrepancy tags show PDF/API mismatch correctly.
- [ ] Management fee values appear in Results table.
- [ ] RR NOI appears correctly.
- [ ] Negative values render in red and with negative sign.
- [ ] Next button stays blocked while upload/AI/autofill/sync is running.
