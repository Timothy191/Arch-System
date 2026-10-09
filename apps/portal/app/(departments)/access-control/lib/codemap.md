# (departments)/access-control/lib/

**Kind:** module · **Files:** 1 (+1 test)

## Responsibility

Supporting module directory for (departments)/access-control/lib.

## Design

- (No client hooks or route methods detected — pure server/data module.)
- Exports:
  - `printer-detection.ts` → scanCupsPrinters, getPrinterQueue, getPrinterStatus, scanUsbDevices, submitCupsPrintJob, detectAllPrinters

## Flow

Imported by the parent route; exposes the exports listed above.

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
