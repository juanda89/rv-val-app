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

    // --- STEP 4: Taxes (ATTOM API + Manual Override) ---
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

    // --- Property Basics (Additional Manual Inputs) ---
    mobile_home_park_name: "C34",
    mobile_home_park_address: "C35",
    parcel_1_acreage: "C36",
    parcel_1: "C37",
    state: "C38",
    population: "C39",
    population_change: "C40",
    poverty_rate: "C41",
    median_household_income: "C42",
    median_household_income_change: "C43",
    number_of_employees: "C44",
    number_of_employees_change: "C45",
    median_property_value: "C46",
    median_property_value_change: "C47",
    violent_crime: "C48",
    property_crime: "C49",
    two_br_rent: "C50",
    eli_renter_households: "C51",
    units_per_100: "C52",
    total_units: "C53",

    // --- Rent Roll (Additional Inputs) ---
    base_capx: "C54",
    capx_mgmt_fees: "C55",
    absorption_lease_up_period: "C56",
    terminal_occupancy: "C57",
    rent_bump_y1: "C58",
    rent_bump_y2_5: "C59",
    loss_to_lease: "C60",

    // --- Acquisition & Operations (Manual Inputs) ---
    appraisal: "C61",
    ppa: "C62",
    pca: "C63",
    esa_phase_1: "C64",
    pza: "C65",
    survey: "C66",
    camera_sewer_electrical_inspection: "C67",
    water_leak_detection: "C68",
    buyer_legal: "C69",
    lender_legal: "C70",
    title_and_closing: "C71",
    loan_origination: "C72",
    travel: "C73",
    contingency: "C74",
    rate_buy_down: "C75",
    buyer_paid_broker_commission: "C76",
    acquisition_fee: "C77",
    credit_loss: "C78",
    annual_inflation: "C79",
    management_fee: "C80",
    monthly_min_management_fee: "C81",
    full_whammy_tax_bump: "C82",
    year_1_tax_increase: "C83",
    property_manager_salary: "C84",
    assistant_property_manager_salary: "C85",
    maintenance_man_salary: "C86",
    number_of_pms: "C87",
    number_of_apms: "C88",
    number_of_mms: "C89",
    rm_per_lot: "C90",
    fair_market_value: "C91",
    assessed_value: "C92",
    previous_year_re_taxes: "C93",

    // --- Taxes & Debt (Additional Inputs) ---
    us_10_year_treasury: "C94",
    spread: "C95",
    spread_escalation_allowance: "C96",
    dscr: "C97",
    max_ltc: "C98",
    loan_term: "C99",
    interest_only_time_period: "C100",
    cap_rate_decompression: "C101",
    real_estate_valuation: "C102",
    preferred_return: "C103",
    lp_split: "C104",
    gp_split: "C105",
    hold_period: "C106",
    cost_of_sale: "C107",
    zip_code: "C108",
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
    max_loan_amount: "C6",
    cash_on_cash_return: "C7",
    current_occupancy: "C8"
  }
};
