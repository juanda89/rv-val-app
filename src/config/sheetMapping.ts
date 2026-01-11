export const SHEET_NAMES = {
  INPUT: 'Input Fields',
  OUTPUT: 'Output Fields',
  CATEGORIZATION: 'Income & Expenses Categorization'
};

export const SHEET_MAPPING = {
  inputs: {
    sheetName: SHEET_NAMES.INPUT,
    // --- STEP 1: General & Demographics (Auto + Manual) ---
    name: "C2",
    city: "C3",
    address: "C4",
    parcelNumber: "B5",
    population_1mile: "B10", // From API
    median_income: "B11",    // From API

    // --- STEP 2: Rent Roll (Manual Input) ---
    total_lots: "C5",
    occupied_lots: "C6",
    current_lot_rent: "C7",

    // --- STEP 3: P&L (Categorized Data) ---
    // REVENUE Categories (6 Total)
    revenue_rental_income: "D5",
    revenue_rv_income: "D6",
    revenue_storage: "D7",
    revenue_late_fees: "D8",
    revenue_utility_reimb: "D9",
    revenue_other: "D10",

    // EXPENSE Categories (9 Total)
    expense_payroll: "E5",
    expense_utilities: "E6",
    expense_rm: "E7",        // Repairs & Maintenance
    expense_advertising: "E8",
    expense_ga: "E9",        // General & Administrative
    expense_insurance: "E10",
    expense_re_taxes: "E11",
    expense_mgmt_fee: "E12",
    expense_reserves: "E13",

    // --- STEP 4: Taxes (ATTOM API + Manual Override) ---
    tax_assessment_rate: "F5",
    tax_millage_rate: "F6",
    tax_prev_year_amount: "F7",
  },
  outputs: {
    sheetName: SHEET_NAMES.OUTPUT,
    // Calculated Results (Read from Sheets formulas)
    valuation_price: "H10",
    noi_annual: "H11",
    cap_rate_entry: "H12",
    equity_needed: "H14",
    max_loan_amount: "H15"
  }
};
