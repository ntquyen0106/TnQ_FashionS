export const getPrimaryClientUrl = () => {
  const raw = process.env.PRIMARY_CLIENT_URL || process.env.CLIENT_URL || '';
  const first = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)[0];
  return first || 'http://localhost:5173';
};
