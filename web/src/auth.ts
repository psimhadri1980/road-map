import Keycloak from 'keycloak-js';

/**
 * Sign-in (002-T002, FR-001–FR-005). Keycloak's own adapter does the authorization code flow with PKCE,
 * the state and nonce checks and the redirect handling; none of that security code is written here
 * (constitution II). The tokens live in the adapter's memory only: nothing is put in storage or in a
 * cookie, so a script injected into the page cannot read one back after the fact (FR-004).
 *
 * The identity provider is reached through the front door on the page's own origin, which is also the
 * address the tokens are issued for (research R3).
 */
const keycloak = new Keycloak({ url: `${location.origin}/auth`, realm: 'road-map', clientId: 'road-map-web' });

/**
 * Sends a user without a session to the sign-in page and resolves once they are back and signed in.
 * With a live identity-provider session the redirect comes straight back without a prompt, so a reload
 * keeps the user signed in (user story 1, scenario 4). Rejects when the identity provider cannot be reached.
 * `checkLoginIframe` is off: the iframe needs third-party cookies that browsers are removing, and the
 * front door forbids framing anyway (research R4).
 */
export async function signIn(): Promise<void> {
  await keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
}

/**
 * Fetches an API path with the bearer token (FR-005, FR-006, FR-018). The token is renewed before the call
 * when it is within 30 s of expiry, so a user working past the 5-minute token life never notices. A `401`
 * means the service or the front door disagreed anyway (clock drift, a session ended elsewhere): renew once
 * by force and retry once; if that still fails, or the renewal itself is refused because the session is
 * over, send the user back to sign-in instead of showing a broken page.
 */
export async function apiFetch(path: string): Promise<Response> {
  const call = () => fetch(path, { headers: { authorization: `Bearer ${keycloak.token}` } });
  try {
    await keycloak.updateToken(30);
    let r = await call();
    if (r.status === 401) {
      await keycloak.updateToken(-1);
      r = await call();
    }
    if (r.status !== 401) return r;
  } catch {
    // renewal refused: the session is over; fall through to sign-in
  }
  await keycloak.login();
  return new Promise<Response>(() => undefined); // the page is being left for the sign-in redirect
}

/** Ends the identity-provider session (FR-012) and returns to the app, which asks for sign-in again. */
export function signOut(): Promise<void> {
  return keycloak.logout({ redirectUri: location.origin });
}
