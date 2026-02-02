export type Role =
  | 'USER'
  | 'HEAD_WARD'
  | 'HEAD_DEPT'
  | 'PTS_OFFICER'
  | 'HEAD_HR'
  | 'HEAD_FINANCE'
  | 'FINANCE_OFFICER'
  | 'DIRECTOR'
  | 'ADMIN';

export interface User {
  id: string;
  username: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  position?: string;
  subDepartment?: string;
  department?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
