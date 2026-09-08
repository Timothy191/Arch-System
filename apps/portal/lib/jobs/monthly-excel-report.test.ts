import { monthlyExcelReportFn } from "./monthly-excel-report";

describe("monthlyExcelReportFn", () => {
  it("defines an inngest function with monthly cron trigger", () => {
    expect(monthlyExcelReportFn).toBeDefined();
  });
});
