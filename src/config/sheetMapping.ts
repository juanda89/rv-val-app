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
    address: "C4",
    parcelNumber: "C5",
    population_1mile: "C6", // From API
    median_income: "C7",    // From API

    // --- STEP 2: Rent Roll (Manual Input) ---
    total_lots: "C8",
    occupied_lots: "C9",
    current_lot_rent: "C10",

    // --- STEP 3: P&L (Categorized Data) ---
    // REVENUE Categories (6 Total)
    revenue_rental_income: "C11",
    revenue_rv_income: "C12",
    revenue_storage: "C13",
    revenue_late_fees: "C14",
    revenue_utility_reimb: "C15",
    revenue_other: "C16",

    // EXPENSE Categories (9 Total)
    expense_payroll: "C17",
    expense_utilities: "C18",
    expense_rm: "C19",        // Repairs & Maintenance
    expense_advertising: "C20",
    expense_ga: "C21",        // General & Administrative
    expense_insurance: "C22",
    expense_re_taxes: "C23",
    expense_mgmt_fee: "C24",
    expense_reserves: "C25",

    // --- STEP 4: Taxes (ATTOM API + Manual Override) ---
    tax_assessment_rate: "C26",
    tax_millage_rate: "C27",
    tax_prev_year_amount: "C28",
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
