// Local reference data from Excel file
export const organizations = [
  { id: '1PWR LESOTHO', name: '1PWR LESOTHO', isActive: true },
  { id: 'SMP', name: 'SMP', isActive: true },
  { id: 'PUECO', name: 'PUECO', isActive: true }
];

// Combine all reference data
export const departments = [
  { id: "c_level", name: "C Level", isActive: true },
  { id: "dpo", name: "DPO", isActive: true },
  { id: "project_management", name: "Project Management", isActive: true },
  { id: "engineering", name: "Engineering", isActive: true },
  { id: "procurement", name: "Procurement", isActive: true },
  { id: "finance", name: "Finance", isActive: true },
  { id: "hr", name: "HR", isActive: true },
  { id: "legal", name: "Legal", isActive: true },
  { id: "ist", name: "IS&T — Information Systems and Technology", isActive: true },
  { id: "operations", name: "Operations", isActive: true },
  { id: "ehs", name: "EHS", isActive: true },
  { id: "communications", name: "Communications", isActive: true },
  { id: "smp_operations", name: "Operations", isActive: true },
  { id: "smp_engineering", name: "Engineering", isActive: true },
  { id: "smp_finance", name: "Finance", isActive: true },
  { id: "smp_procurement", name: "Procurement", isActive: true },
  { id: "smp_hr", name: "HR", isActive: true }
];

export const projectCategories = [
  { id: "1:20mw", name: "1:20MW", isActive: true },
  { id: "2:engineering_randd", name: "2:Engineering R&D", isActive: true },
  { id: "4:minigrids", name: "4:Minigrids", isActive: true },
  { id: "5:general", name: "5:General", isActive: true },
  { id: "maintenance", name: "Maintenance", isActive: true },
  { id: "expansion", name: "Expansion", isActive: true },
  { id: "operations", name: "Operations", isActive: true }
];

export const sites = [
  { id: "ha_makebe", name: "Ha Makebe", code: "MAK", isActive: true },
  { id: "ha_raliemere", name: "Ha Raliemere", code: "RAL", isActive: true },
  { id: "tosing", name: "Tosing", code: "TOS", isActive: true },
  { id: "sebapala", name: "Sebapala", code: "SEB", isActive: true },
  { id: "sehlabathebe", name: "Sehlabathebe", code: "SEH", isActive: true },
  { id: "sehonghong", name: "Sehonghong", code: "SHG", isActive: true },
  { id: "mashai", name: "Mashai", code: "MAS", isActive: true },
  { id: "matsoaing", name: "Matsoaing", code: "MAT", isActive: true },
  { id: "lebakeng", name: "Lebakeng", code: "LEB", isActive: true },
  { id: "tlhanyaku", name: "Tlhanyaku", code: "TLH", isActive: true },
  { id: "ribaneng", name: "Ribaneng", code: "RIB", isActive: true },
  { id: "ketane", name: "Ketane", code: "KET", isActive: true },
  { id: "ha_nkau", name: "Ha Nkau", code: "NKU", isActive: true },
  { id: "methalaneng", name: "Methalaneng", code: "MET", isActive: true },
  { id: "manamaneng", name: "Manamaneng", code: "MAN", isActive: true },
  { id: "bobete", name: "Bobete", code: "BOB", isActive: true },
  { id: "1pwr_headquarters", name: "1PWR Headquarters", code: "HQ", isActive: true },
  { id: "factory", name: "Factory", code: "FAC", isActive: true },
  { id: "warehouse", name: "Warehouse", code: "WH", isActive: true },
  { id: "head_office", name: "Head Office", code: "HO", isActive: true },
  { id: "smp_factory", name: "Factory", code: "FAC", isActive: true },
  { id: "smp_warehouse", name: "Warehouse", code: "WH", isActive: true },
  { id: "smp_office", name: "Head Office", code: "HO", isActive: true }
];

export const expenseTypes = [
  { id: "audit_+_accounting_fees", name: "1 - Audit + Accounting Fees", code: "1", isActive: true },
  { id: "bank_fees", name: "2 - Bank Fees", code: "2", isActive: true },
  { id: "materials_and_supplies_(including_fees_to_clearing_agents)", name: "3A - Materials and supplies (including fees to clearing agents)", code: "3A", isActive: true },
  { id: "materials_and_supplies_-_ehs_items_(other_than_ppe)", name: "3B - Materials and supplies - EHS items (other than PPE)", code: "3B", isActive: true },
  { id: "materials_and_supplies_-_ppe_(only_group_issue:_goggles,_hard_hats,_gloves)", name: "3C - Materials and supplies - PPE (ONLY group issue: goggles, hard hats, gloves)", code: "3C", isActive: true },
  { id: "vehicle", name: "4 - Vehicle", code: "4", isActive: true },
  { id: "office_supplies_-_except_it_items", name: "5A - Office Supplies - except IT items", code: "5A", isActive: true },
  { id: "office_supplies_-_it_items_(keyboard,_mouse,_usb_stick,_phone,_tablet,_etc.)", name: "5B - Office Supplies - IT items (keyboard, mouse, USB stick, phone, tablet, etc.)", code: "5B", isActive: true },
  { id: "training", name: "6 - Training", code: "6", isActive: true },
  { id: "communications", name: "7 - Communications", code: "7", isActive: true },
  { id: "postage_+_shipping", name: "8 - Postage + Shipping", code: "8", isActive: true },
  { id: "travel_(includes_accommodation,_meals,_tolls)", name: "9 - Travel (includes accommodation, meals, tolls)", code: "9", isActive: true },
  { id: "insurance", name: "10 - Insurance", code: "10", isActive: true },
  { id: "fuel", name: "11 - Fuel", code: "11", isActive: true },
  { id: "legal_fees", name: "12 - Legal fees", code: "12", isActive: true },
  { id: "license_and_permits", name: "13 - License and permits", code: "13", isActive: true },
  { id: "rent", name: "14 - Rent", code: "14", isActive: true },
  { id: "salaries_and_wages", name: "15 - Salaries and wages", code: "15", isActive: true },
  { id: "general", name: "16 - General", code: "16", isActive: true },
  { id: "equipment_(including_computers,_electric_tools,_generators,_etc.)_-_should_be_>_m_2000", name: "17A - Equipment (including computers, electric tools, generators, etc.) - should be > M 2000", code: "17A", isActive: true },
  { id: "parts_for_constructing_an_asset_(parts_for_pv_tracker,_minigrid_infrastructure)", name: "17B - Parts for constructing an asset (parts for PV tracker, minigrid infrastructure)", code: "17B", isActive: true },
  { id: "sub-contractors", name: "18 - Sub-contractors", code: "18", isActive: true },
  { id: "reimbursable", name: "19 - Reimbursable", code: "19", isActive: true },
  { id: "vat_(paid_to_sars_or_lra_for_clearing)", name: "220 - VAT (paid to SARS or LRA for clearing)", code: "220", isActive: true },
  { id: "equipment_rental", name: "26 - Equipment rental", code: "26", isActive: true },
  { id: "meals_and_meetings", name: "28 - Meals and meetings", code: "28", isActive: true },
  { id: "utilities_(lec,_lewa)", name: "30 - Utilities (LEC, LEWA)", code: "30", isActive: true },
  { id: "property_maintenance_(lndc_factory,_minigrid_powerhouse)", name: "31 - Property maintenance (LNDC factory, minigrid powerhouse)", code: "31", isActive: true },
  { id: "other", name: "X - Other", code: "X", isActive: true }
];

export const vehicles = [
  { id: "36", name: "36", registration: "RLL415J", isActive: true },
  { id: "compressor", name: "Compressor", registration: "", isActive: true },
  { id: "drill_rig", name: "Drill rig", registration: "", isActive: true },
  { id: "forklift", name: "Forklift", registration: "", isActive: true },
  { id: "generator", name: "Generator", registration: "", isActive: true },
  { id: "isuzu", name: "Isuzu", registration: "RLL415J", isActive: true },
  { id: "land_cruiser", name: "Land Cruiser", registration: "RLL415J", isActive: true },
  { id: "mazda", name: "Mazda", registration: "RLL415J", isActive: true },
  { id: "mercedes_benz", name: "Mercedes Benz", registration: "RLL415J", isActive: true },
  { id: "nissan", name: "Nissan", registration: "RLL415J", isActive: true },
  { id: "toyota", name: "Toyota", registration: "RLL415J", isActive: true },
  { id: "trailer", name: "Trailer", registration: "", isActive: true },
  { id: "truck", name: "Truck", registration: "RLL415J", isActive: true },
  { id: "van", name: "Van", registration: "RLL415J", isActive: true }
];

export const vendors = [
  { id: "other", name: "Other", isActive: true },
  { id: "herholdts", name: "Herholdts", isActive: true },
  { id: "revenue_services_lesotho", name: "Revenue Services Lesotho", isActive: true },
  { id: "lesotho_electricity_company", name: "Lesotho Electricity Company", isActive: true },
  { id: "vodacom_lesotho", name: "Vodacom Lesotho", isActive: true },
  { id: "econet", name: "Econet", isActive: true },
  { id: "afrox", name: "Afrox", isActive: true },
  { id: "vyfster", name: "Vyfster", isActive: true },
  { id: "thetsane_hardware", name: "Thetsane Hardware", isActive: true },
  { id: "bbcdc", name: "BBCDC", isActive: true }
];

export const approvers = [
  { id: "smp_manager", name: "SMP Manager", role: "MANAGER", isActive: true },
  { id: "smp_director", name: "SMP Director", role: "DIRECTOR", isActive: true },
];

export const currencies = [
  { id: "lsl", name: "Lesotho Loti", code: "LSL", isActive: true },
  { id: "zar", name: "South African Rand", code: "ZAR", isActive: true },
  { id: "usd", name: "US Dollar", code: "USD", isActive: true },
  { id: "eur", name: "Euro", code: "EUR", isActive: true },
  { id: "gbp", name: "British Pound", code: "GBP", isActive: true }
];
