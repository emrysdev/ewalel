import { useEffect } from 'react';

const KEY = 'ewalel_visit_session';
const IDLE = 30 * 60 * 1000;
export default function PublicVisitTracker({ base }) {
  useEffect(() => {
    let lastPage = '';
    function record() {
      const page = window.location.pathname;
      if (page.startsWith('/admin')) return;
      let session;
      try {
        session = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      } catch { session = null; }
      const now = Date.now();
      if (!session?.id || now - Number(session.last || 0) > IDLE) {
        session = { id: crypto.randomUUID(), last: now };
      } else { session.last = now; }
      sessionStorage.setItem(KEY, JSON.stringify(session));
      // Avoid duplicate records from React rerenders on the same page.
      if (lastPage === page) return;
      lastPage = page;
      fetch(`${base}/api/analytics/visit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, page }), keepalive: true
      }).catch(() => {});
    }
    record();
    const onNav = () => record();
    window.addEventListener('popstate', onNav);
    const oldPush = history.pushState;
    const oldReplace = history.replaceState;
    history.pushState = function (...args) { const result = oldPush.apply(this, args); record(); return result; };
    history.replaceState = function (...args) { const result = oldReplace.apply(this, args); record(); return result; };
    return () => {
      window.removeEventListener('popstate', onNav);
      history.pushState = oldPush;
      history.replaceState = oldReplace;
    };
  }, [base]);
  return null;
}
