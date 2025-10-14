// src/utils/session.js
export function getSessionId() {
  let sid = localStorage.getItem('sessionId');
  if (!sid) {
    sid = (crypto?.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2);
    localStorage.setItem('sessionId', sid);
  }
  return sid;
}
