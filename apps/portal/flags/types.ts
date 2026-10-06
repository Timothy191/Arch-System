/**
 * Entity Types for Vercel Feature Flags
 * Maps context attributes to typed Entities for evaluation.
 */

export interface User {
  id?: string;
  email?: string;
  plan?: string;
  department?: string;
  role?: string;
}

export interface DepartmentEntity {
  id?: string;
  name?: string;
  site?: string;
}

export type Entities = {
  user?: User;
  department?: DepartmentEntity;
};
