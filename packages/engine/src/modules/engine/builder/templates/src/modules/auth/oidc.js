import {createRemoteJWKSet, jwtVerify} from "jose";
import {Config} from "../../config/config.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
import {anonymousAdmin, principalFromClaims} from "./roles.js";

const Logger = new AndromedaLogger();

/** An error carrying the HTTP status the route should answer with. */
export class AuthError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

/**
 * Validates bearer JWTs against an OpenID Connect provider (optional - see
 * OIDC_ENABLED). The signing keys come from the provider's JWKS, found via
 * `<OIDC_ISSUER>/.well-known/openid-configuration` (or OIDC_JWKS_URI);
 * issuer, audience (OIDC_AUDIENCE, when set), expiry and signature are
 * checked by jose.
 */
export class OidcVerifier {
    /**
     * @param {{issuer: string, audience?: string, jwksUri?: string, rolesClaims?: string[], adminRole?: string, clockToleranceSeconds?: number}} options
     */
    constructor({issuer, audience, jwksUri, rolesClaims, adminRole, clockToleranceSeconds = 30}) {
        if (!issuer) {
            throw new Error('OIDC is enabled but OIDC_ISSUER is not set');
        }
        this.issuer = issuer.replace(/\/$/, '');
        this.audience = audience || undefined;
        this.jwksUri = jwksUri || null;
        this.rolesClaims = rolesClaims;
        this.adminRole = adminRole;
        this.clockToleranceSeconds = clockToleranceSeconds;
        this.jwks = null;
    }

    async keySet() {
        if (!this.jwks) {
            let jwksUri = this.jwksUri;
            if (!jwksUri) {
                const discovery = `${this.issuer}/.well-known/openid-configuration`;
                let response;
                try {
                    response = await fetch(discovery, {signal: AbortSignal.timeout(10_000)});
                } catch (error) {
                    throw new AuthError(`OIDC discovery failed (${discovery}: ${error.cause?.code || error.message})`, 503);
                }
                if (!response.ok) {
                    throw new AuthError(`OIDC discovery failed (${discovery} answered HTTP ${response.status})`, 503);
                }
                jwksUri = (await response.json()).jwks_uri;
                if (!jwksUri) {
                    throw new AuthError(`OIDC discovery document at ${discovery} has no jwks_uri`, 503);
                }
            }
            // jose caches the keys and refetches on an unknown key id (rotation)
            this.jwks = createRemoteJWKSet(new URL(jwksUri));
        }
        return this.jwks;
    }

    /**
     * @param {string} token - compact JWT
     * @returns {Promise<object>} the principal (see roles.js)
     * @throws {AuthError} 401 for an invalid token, 503 when the provider can't be reached
     */
    async verify(token) {
        const keySet = await this.keySet();
        try {
            const {payload} = await jwtVerify(token, keySet, {
                issuer: this.issuer,
                audience: this.audience,
                clockTolerance: this.clockToleranceSeconds,
            });
            return principalFromClaims(payload, {rolesClaims: this.rolesClaims, adminRole: this.adminRole});
        } catch (error) {
            if (error instanceof AuthError) throw error;
            // the keys couldn't be fetched (timeout / network) - not the caller's fault
            if (error.code === 'ERR_JWKS_TIMEOUT' || error instanceof TypeError) {
                throw new AuthError(`could not reach the OIDC provider's keys: ${error.message}`, 503);
            }
            Logger.debug(`rejected bearer token: ${error.code || ''} ${error.message}`);
            throw new AuthError(`invalid token: ${error.message}`, 401);
        }
    }
}

let verifier = null;

function getVerifier() {
    if (!verifier) {
        const config = Config.getInstance();
        verifier = new OidcVerifier({
            issuer: config.oidcIssuer,
            audience: config.oidcAudience,
            jwksUri: config.oidcJwksUri,
            rolesClaims: config.oidcRolesClaims,
            adminRole: config.oidcAdminRole,
        });
    }
    return verifier;
}

/**
 * Who is calling. With OIDC off, everyone acts as the admin (unchanged
 * behaviour); with it on, a valid `Authorization: Bearer <jwt>` is required.
 * @param {{headers: object}} request - fastify request
 * @throws {AuthError}
 */
export async function authenticate(request) {
    const config = Config.getInstance();
    if (!config.oidcEnabled) {
        return anonymousAdmin(config.oidcAdminRole);
    }
    const header = request.headers?.authorization || '';
    const match = header.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
        throw new AuthError('authentication required: send an OIDC access token as "Authorization: Bearer <token>"', 401);
    }
    return getVerifier().verify(match[1]);
}
