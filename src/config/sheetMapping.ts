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

    // --- STEP 3: P&L (Categorized Data) ---
    // REVENUE Categories (6 Total)
    revenue_rental_income: "C12",
    revenue_rv_income: "C13",
    revenue_storage: "C14",
    revenue_late_fees: "C15",
    revenue_utility_reimb: "C16",
    revenue_other: "C17",

    // EXPENSE Categories (9 Total)
    expense_payroll: "C18",
    expense_utilities: "C19",
    expense_rm: "C20",        // Repairs & Maintenance
    expense_advertising: "C21",
    expense_ga: "C22",        // General & Administrative
    expense_insurance: "C23",
    expense_re_taxes: "C24",
    expense_mgmt_fee: "C25",
    expense_reserves: "C26",

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
