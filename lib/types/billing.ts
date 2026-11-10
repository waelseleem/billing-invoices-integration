export interface MonthBillingDto {
  lineId: string
  csType: string
  branche: string
  costCenter: string
  billingDate: Date
  entagtam: number
  sewer: number
  tanzeem: number
  estdama: number
  contract: number
  taxes: number
  rounding: number
  waterCredit: number
  sewerCredit: number
  waterDebit: number
  sewerDebit: number
  consump: number
  glAccountCode?: string
  glAccountName?: string
  activityCode?: string
  branchCode?: string
  ShortName?: string
} 