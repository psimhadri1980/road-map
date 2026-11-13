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

/** The current access token, for the Authorization header of an API call (FR-005). */
export function bearer(): string {
  if (!keycloak.token) throw new Error('not signed in');
  return keycloak.token;
}
