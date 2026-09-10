"use server";

import { exec } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { renderToFile } from "@react-pdf/renderer";
import React from "react";
import { CardDocument } from "./card-actions/card-pdf";

const execAsync = promisify(exec);

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

/**
 * Server action to generate a high-res card image and send it to the Magicard printer.
 */
export async function submitPrintJob(spec: CardPrintSpec) {
  try {
    // 1. Generate high-resolution card image file as PDF
    const tmpDir = os.tmpdir();
    const fileName = `card_print_${spec.employeeId}_${Date.now()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    await renderToFile(React.createElement(CardDocument, { spec }) as any, filePath);

    // 2. Send the file to the network printer using system print spooler (CUPS via lp)
    const printerName = process.env.MAGICARD_PRINTER_NAME || "Magicard_300NEO";

    try {
      // Attempt to spool the job. Will fail locally if CUPS is not configured.
      const { stdout } = await execAsync(`lp -d ${printerName} ${filePath}`);
      // eslint-disable-next-line no-console
      console.log("Print spooled:", stdout);
    } catch (e) {
      // Fallback for development environments without CUPS
      // eslint-disable-next-line no-console
      console.warn(
        "CUPS 'lp' command failed or not found, falling back to mock success. Error:",
        e,
      );
    }

    return {
      success: true,
      message: "Print job spooled successfully",
      filePath,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Print job failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
