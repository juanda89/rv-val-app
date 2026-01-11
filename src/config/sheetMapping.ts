export const SHEET_NAMES = {
  INPUT: 'Input Fields',
  OUTPUT: 'Output Fields',
  CATEGORIZATION: 'Income & Expenses Categorization'
};

export const SHEET_MAPPING = {
  inputs: {
    sheetName: SHEET_NAMES.INPUT,
    // Values always in column C starting at row 2.
    // Column B is reserved for the variable name label.
    // --- STEP 1: General & Demographics (Auto + Manual) ---
    name: "C2",
    city: "C3",
    county: "C4",
    address: "C5",
    parcelNumber: "C6",
    population_1mile: "C7", // From API
    median_income: "C8",    // From API

    // --- STEP 2: Rent Roll (Manual Input) ---
    total_lots: "C9",
    occupied_lots: "C10",
    current_lot_rent: "C11",

    // --- STEP 3: P&L (handled in Income & Expenses Categorization sheet) ---

    // --- STEP 4: Taxes (ATTOM API + Manual Override) ---
    tax_assessment_rate: "C27",
    tax_millage_rate: "C28",
    tax_prev_year_amount: "C29",
  },
  outputs: {
    sheetName: SHEET_NAMES.OUTPUT,
    // Calculated Results (Read from Sheets formulas)
    // Values always in column C starting at row 2.
    // Column B is reserved for the variable name label.
    valuation_price: "C2",
    noi_annual: "C3",
    cap_rate_entry: "C4",
    equity_needed: "C5",
    max_loan_amount: "C6"
  }
};
