// Type definitions for Income and Expense system

export interface FormulaSetting {
  carManagementSplitPercent: number;
  carOwnerSplitPercent: number;
  monthModes?: { [month: number]: 50 | 70 };
  skiRacksOwner?: { [month: number]: "GLA" | "CAR_OWNER" };
}

export interface MonthMode {
  month: number;
  mode: 50 | 70; // 50 = 50:50 split, 70 = 30:70 split
}

export interface IncomeExpenseMonth {
  month: number;
  rentalIncome: number;
  deliveryIncome: number;
  electricPrepaidIncome: number;
  smokingFines: number;
  gasPrepaidIncome: number;
  skiRacksIncome: number;
  milesIncome: number;
  childSeatIncome: number;
  coolersIncome: number;
  insuranceWreckIncome: number;
  otherIncome: number;
  negativeBalanceCarryOver: number;
  carPayment: number;
  carManagementTotalExpenses: number;
  carOwnerTotalExpenses: number;
  // Backend-aggregated totals for the "All Cars" view only. These are
  // computed per-car (respecting each car's own split %, 50:50 vs 30:70
  // mode, and ski-racks owner) and then summed. The per-car view does not
  // populate these and should keep using the local formula helpers.
  mgmtIncome?: number;
  ownerIncome?: number;
}

export interface DirectDeliveryMonth {
  month: number;
  laborCarCleaning: number;
  laborDelivery: number;
  parkingAirport: number;
  parkingLot: number;
  uberLyftLime: number;
}

export interface CogsMonth {
  month: number;
  autoBodyShopWreck: number;
  alignment: number;
  battery: number;
  brakes: number;
  carPayment: number;
  carInsurance: number;
  carSeats: number;
  cleaningSuppliesTools: number;
  emissions: number;
  gpsSystem: number;
  keyFob: number;
  laborCleaning: number;
  licenseRegistration: number;
  mechanic: number;
  oilLube: number;
  parts: number;
  skiRacks: number;
  tickets: number;
  tiredAirStation: number;
  tires: number;
  towingImpoundFees: number;
  uberLyftLime: number;
  windshield: number;
  wipers: number;
}

export interface ParkingFeeLaborMonth {
  month: number;
  glaParkingFee: number;
  laborCleaning: number;
}

export interface ReimbursedBillsMonth {
  month: number;
  electricReimbursed: number;
  electricNotReimbursed: number;
  gasReimbursed: number;
  gasNotReimbursed: number;
  gasServiceRun: number;
  parkingAirport: number;
  uberLyftLimeNotReimbursed: number;
  uberLyftLimeReimbursed: number;
}

export interface OfficeSupportMonth {
  month: number;
  accountingProfessionalFees: number;
  advertizing: number;
  bankCharges: number;
  detailMobile: number;
  charitableContributions: number;
  computerInternet: number;
  deliveryPostageFreight: number;
  detailShopEquipment: number;
  duesSubscription: number;
  generalAdministrative: number;
  healthWellness: number;
  laborSales: number;
  laborSoftware: number;
  legalProfessional: number;
  marketing: number;
  mealsEntertainment: number;
  officeExpense: number;
  officeRent: number;
  outsideStaffContractors: number;
  parkNJetBooth: number;
  printing: number;
  referral: number;
  repairsMaintenance: number;
  salesTax: number;
  securityCameras: number;
  shippingFreightDelivery: number;
  suppliesMaterials: number;
  taxesLicense: number;
  telephone: number;
  travel: number;
  depreciationExpense: number;
  vehicleDepreciationExpense: number;
  vehicleLoanInterestExpense: number;
}

export interface HistoryMonth {
  month: number;
  daysRented: number;
  carsAvailableForRent: number;
  tripsTaken: number;
}

export interface ParkingAirportQBMonth {
  month: number;
  totalParkingAirport: number;
}

export interface DynamicSubcategory {
  id: number;
  name: string;
  displayOrder: number;
  values: Array<{ month: number; value: number }>;
}

export interface IncomeExpenseData {
  formulaSetting: FormulaSetting | null;
  incomeExpenses: IncomeExpenseMonth[];
  directDelivery: DirectDeliveryMonth[];
  cogs: CogsMonth[];
  parkingFeeLabor: ParkingFeeLaborMonth[];
  reimbursedBills: ReimbursedBillsMonth[];
  officeSupport: OfficeSupportMonth[];
  history: HistoryMonth[];
  parkingAirportQB: ParkingAirportQBMonth[];
  dynamicSubcategories?: {
    directDelivery: DynamicSubcategory[];
    cogs: DynamicSubcategory[];
    parkingFeeLabor: DynamicSubcategory[];
    reimbursedBills: DynamicSubcategory[];
  };
}

export interface EditingCell {
  category: string;
  field: string;
  month: number;
  value: number;
}
