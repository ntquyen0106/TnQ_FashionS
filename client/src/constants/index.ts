export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  USER: 'user',
} as const;

export const ORDER_STATUS = [
  'new',
  'processing',
  'shipping',
  'delivering',
  'completed',
  'canceled',
  'returned',
] as const;

export const DASHBOARD_ROUTES: Record<string, string> = {
  admin: '/dashboard/admin',
  staff: '/dashboard',
  user: '/',
};
