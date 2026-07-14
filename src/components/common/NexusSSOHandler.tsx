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

    signInWithCustomToken(auth, token)
      .then(() => {
        params.delete('sso_token');
        params.delete('nonce');
        params.delete('from');
        params.delete('lang');
        navigate({ search: params.toString() }, { replace: true });
      })
      .catch((err) => console.error('[Nexus SSO] sign-in failed:', err));
  }, [params, navigate]);

  return null;
}
