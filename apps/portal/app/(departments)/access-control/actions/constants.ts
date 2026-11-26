/**
 * Canonical Emergency Muster Stations for the Access Control department.
 * Kept in a dedicated constants module so Server Action tests that mock
 * `./shared` do not accidentally erase station metadata.
 */
export const CANONICAL_MUSTER_STATIONS = [
  {
    id: 'STA-ENG',
    name: 'Engineering Department',
    location: 'Engineering Office & Workshop Plaza',
    targetZone: 'Engineering & Maintenance Yard',
  },
  {
    id: 'STA-OFF',
    name: 'Office Department',
    location: 'Administration Complex',
    targetZone: 'Administration Offices',
  },
  {
    id: 'STA-PROD',
    name: 'Production & Logistics Department',
    location: 'Main Gate & Pit Surface',
    targetZone: 'Production & Logistics Assembly',
  },
] as const;
