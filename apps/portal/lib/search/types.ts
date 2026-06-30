export type ArchSearchCategory = "department" | "employee" | "shift";

export interface ArchSearchResult {
  id: string;
  category: ArchSearchCategory;
  title: string;
  subtitle: string;
  href: string;
}

export interface ArchSearchResponse {
  query: string;
  results: ArchSearchResult[];
}
