export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  USER: 'user',
} as const;

export const ORDER_STATUS = [
  'new',
  'processing',
  'packed',
  'shipped',
  'completed',
  'canceled',
] as const;

export const DASHBOARD_ROUTES: Record<string, string> = {
  admin: '/dashboard/admin',
  staff: '/dashboard',
  user: '/',
};
