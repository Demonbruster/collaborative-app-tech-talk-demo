export const COUCH_DB_URL = 'http://localhost:5984/';

export const getTenantId = (): string | null => {
  // In a real application, you might get this from a JWT token, session, or other auth mechanism
  const session = localStorage.getItem('session');
  if (session) {
    try {
      const { userCtx } = JSON.parse(session);
      return userCtx?.name?.split(':')[0] || null;
    } catch {
      return null;
    }
  }
  return null;
}; 