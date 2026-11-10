# Spec: Complexity hotspot refactor (cyclomatic > 8)

Status: DONE (2026-11-10). Refactored handleExcavatorMaterialChange in ExcavatorActivityForm.tsx by extracting resolveNextSubCategory, updateLoadsMaterial, buildExcavatorMaterialTransition, applyExcavatorMaterialState, notifyRegularMachineMaterial, and adjustPendingMutationCount helpers; cyclomatic complexity reduced from 20 -> 3 (<= 8 invariant satisfied). Verification: type-check & lint:agent-rules pass.
