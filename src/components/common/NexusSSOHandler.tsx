import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebase';
import i18n from '../../config/i18n';

/**
 * Nexus SSO handler — additive, no-op unless ?sso_token=...&from=nexus is present.
 * Signs the user in via Firebase `signInWithCustomToken` (token minted by the
 * Nexus mintSSOToken Cloud Function), then strips the SSO params from the URL.
 * The app's normal onAuthStateChanged flow then loads the user. Native login is
 * preserved.
 *
 * Also reads the optional `view_as` param (set by Nexus IS&T "View As" mode)
 * and stores it in localStorage so the auth flow can apply a display-only
 * permission override while blocking all write actions.
 */
export function NexusSSOHandler() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const token = params.get('sso_token');
    const from = params.get('from');
    if (!token || from !== 'nexus') return;

    handled.current = true;

    // Pick up language preference from Nexus SSO launch
    const lang = params.get('lang');
    if (lang === 'fr' || lang === 'en') {
      localStorage.setItem('language', lang);
      i18n.changeLanguage(lang);
    }

    // Pick up view_as param (IS&T "View As" mode from Nexus)
    const viewAs = params.get('view_as');
    if (viewAs) {
      localStorage.setItem('pr_view_as', viewAs);
    } else {
      localStorage.removeItem('pr_view_as');
    }

    signInWithCustomToken(auth, token)
      .then(() => {
        params.delete('sso_token');
        params.delete('nonce');
        params.delete('from');
        params.delete('lang');
        params.delete('view_as');
        navigate({ search: params.toString() }, { replace: true });
      })
      .catch((err) => console.error('[Nexus SSO] sign-in failed:', err));
  }, [params, navigate]);

  return null;
}
