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
    acreage: "C12",
    year_built: "C13",
    property_type: "C14",
    last_sale_price: "C15",

    // --- STEP 2: Rent Roll (Manual Input) ---
    total_lots: "C9",
    occupied_lots: "C10",
    current_lot_rent: "C11",

    // --- STEP 3: P&L (handled in Income & Expenses Categorization sheet) ---

    // --- STEP 4: Taxes (RentCast API + Manual Override) ---
    tax_assessed_value: "C25",
    tax_year: "C26",
    tax_assessment_rate: "C27",
    tax_millage_rate: "C28",
    tax_prev_year_amount: "C29",

    // --- Valuation Drivers ---
    annual_rent_growth: "C30",
    expense_inflation: "C31",
    exit_cap_rate: "C32",
    occupancy_target: "C33",
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
