/**
 * Roles and permissions, independent of how a token was verified.
 *
 * A principal is {authenticated, subject, roles, admin, anonymous}. The admin
 * role (OIDC_ADMIN_ROLE, `process-admin` by default) may do anything.
 */

export const DEFAULT_ADMIN_ROLE = 'process-admin';
// Keycloak puts realm roles under realm_access.roles; many providers use a
// top-level `roles` claim - both are read unless OIDC_ROLES_CLAIM says otherwise
export const DEFAULT_ROLES_CLAIMS = ['roles', 'realm_access.roles'];

/**
 * Collects role names from the claims at the given dotted paths (arrays of
 * strings, or a single space/comma separated string).
 * @param {object} claims - verified JWT payload
 * @param {string[]} paths - e.g. ['roles', 'realm_access.roles', 'resource_access.my-client.roles']
 * @returns {string[]}
 */
export function extractRoles(claims, paths = DEFAULT_ROLES_CLAIMS) {
    const roles = new Set();
    for (const claimPath of paths) {
        const value = claimPath.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), claims);
        const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : [];
        list.filter((role) => typeof role === 'string' && role.length > 0).forEach((role) => roles.add(role));
    }
    return [...roles];
}

/**
 * @param {object} claims - verified JWT payload
 * @param {{rolesClaims?: string[], adminRole?: string}} [options]
 */
export function principalFromClaims(claims, {rolesClaims = DEFAULT_ROLES_CLAIMS, adminRole = DEFAULT_ADMIN_ROLE} = {}) {
    const roles = extractRoles(claims, rolesClaims);
    return {
        authenticated: true,
        anonymous: false,
        subject: claims.sub || null,
        name: claims.preferred_username || claims.name || claims.email || claims.sub || null,
        roles,
        admin: roles.includes(adminRole),
    };
}

/** When OIDC is off every caller acts as the admin - the pre-OIDC behaviour. */
export function anonymousAdmin(adminRole = DEFAULT_ADMIN_ROLE) {
    return {authenticated: false, anonymous: true, subject: null, name: null, roles: [adminRole], admin: true};
}

/**
 * May this principal complete a task restricted to `taskRoles`?
 * Admin: always. Task without roles: any authenticated principal.
 * Otherwise: at least one role in common.
 * @param {{admin: boolean, roles: string[]}} principal
 * @param {string[]} taskRoles
 */
export function canExecute(principal, taskRoles = []) {
    if (!principal) return false;
    if (principal.admin) return true;
    if (taskRoles.length === 0) return principal.authenticated;
    return taskRoles.some((role) => principal.roles.includes(role));
}
