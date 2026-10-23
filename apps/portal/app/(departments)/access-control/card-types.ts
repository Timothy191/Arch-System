export interface CardPrintSpec {
  employeeId: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  jobTitle: string;
  qrCodeData: string;
  magStripeData?: string;
  holokoteDesign?: string;
}
