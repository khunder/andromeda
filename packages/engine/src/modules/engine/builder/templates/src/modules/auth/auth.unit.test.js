import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import http from 'http';
import {exportJWK, generateKeyPair, SignJWT} from 'jose';
import {anonymousAdmin, canExecute, extractRoles, principalFromClaims} from './roles.js';
import {authenticate, AuthError, OidcVerifier} from './oidc.js';

describe('roles', () => {
    it('reads roles from top-level and nested claims, arrays or strings', () => {
        expect(extractRoles({roles: ['approver'], realm_access: {roles: ['process-admin', 'approver']}}))
            .toEqual(['approver', 'process-admin']);
        expect(extractRoles({scope_roles: 'a b,c'}, ['scope_roles'])).toEqual(['a', 'b', 'c']);
        expect(extractRoles({resource_access: {app: {roles: ['x']}}}, ['resource_access.app.roles'])).toEqual(['x']);
        expect(extractRoles({}, ['roles', 'missing.path'])).toEqual([]);
    });

    it('marks the admin role and names the principal', () => {
        expect(principalFromClaims({sub: 'u1', preferred_username: 'ann', roles: ['process-admin']}))
            .toMatchObject({authenticated: true, subject: 'u1', name: 'ann', admin: true});
        expect(principalFromClaims({sub: 'u2', roles: ['boss']}, {adminRole: 'boss'}).admin).toBe(true);
    });

    it.each([
        ['admin, any task', {admin: true, authenticated: true, roles: []}, ['approver'], true],
        ['matching role', {admin: false, authenticated: true, roles: ['approver']}, ['approver', 'legal'], true],
        ['no matching role', {admin: false, authenticated: true, roles: ['clerk']}, ['approver'], false],
        ['task without roles, authenticated', {admin: false, authenticated: true, roles: []}, [], true],
        ['task without roles, unauthenticated', {admin: false, authenticated: false, roles: []}, [], false],
        ['OIDC off (anonymous admin)', anonymousAdmin(), ['approver'], true],
    ])('canExecute: %s', (label, principal, taskRoles, expected) => {
        expect(canExecute(principal, taskRoles)).toBe(expected);
    });
});

describe('OidcVerifier', () => {
    let server;
    let issuer;
    let privateKey;
    let otherKey;

    beforeAll(async () => {
        const pair = await generateKeyPair('RS256');
        privateKey = pair.privateKey;
        otherKey = (await generateKeyPair('RS256')).privateKey;
        const jwk = {...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig'};
        server = http.createServer((req, res) => {
            res.setHeader('content-type', 'application/json');
            if (req.url === '/realms/test/.well-known/openid-configuration') {
                res.end(JSON.stringify({issuer, jwks_uri: `${issuer}/certs`}));
            } else if (req.url === '/realms/test/certs') {
                res.end(JSON.stringify({keys: [jwk]}));
            } else {
                res.statusCode = 404;
                res.end('{}');
            }
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        issuer = `http://127.0.0.1:${server.address().port}/realms/test`;
    });

    afterAll(() => new Promise((resolve) => server.close(resolve)));

    const token = (claims = {}, {key = privateKey, iss = issuer, aud = 'andromeda', exp = '5m'} = {}) =>
        new SignJWT({sub: 'user-1', preferred_username: 'ann', ...claims})
            .setProtectedHeader({alg: 'RS256', kid: 'k1'})
            .setIssuer(iss)
            .setAudience(aud)
            .setIssuedAt()
            .setExpirationTime(exp)
            .sign(key);

    it('accepts a valid token and reads its roles (Keycloak style)', async () => {
        const verifier = new OidcVerifier({issuer, audience: 'andromeda'});
        const principal = await verifier.verify(await token({realm_access: {roles: ['approver']}}));
        expect(principal).toMatchObject({authenticated: true, subject: 'user-1', name: 'ann', roles: ['approver'], admin: false});
    });

    it('recognises the admin role', async () => {
        const verifier = new OidcVerifier({issuer});
        expect((await verifier.verify(await token({roles: ['process-admin']}))).admin).toBe(true);
    });

    it.each([
        ['another issuer', {iss: 'http://elsewhere/realms/x'}],
        ['another audience', {aud: 'someone-else'}],
        ['a foreign signing key', {key: 'other'}],
        ['an expired token', {exp: Math.floor(Date.now() / 1000) - 3600}],
    ])('rejects %s with a 401', async (label, options) => {
        const verifier = new OidcVerifier({issuer, audience: 'andromeda'});
        const jwt = await token({}, {...options, key: options.key === 'other' ? otherKey : privateKey});
        await expect(verifier.verify(jwt)).rejects.toMatchObject({statusCode: 401});
    });

    it('rejects a malformed token with a 401', async () => {
        await expect(new OidcVerifier({issuer}).verify('not.a.jwt')).rejects.toBeInstanceOf(AuthError);
    });

    it('answers 503 when the provider cannot be reached', async () => {
        const verifier = new OidcVerifier({issuer: 'http://127.0.0.1:1/realms/none'});
        await expect(verifier.verify(await token())).rejects.toMatchObject({statusCode: 503});
    });

    it('needs an issuer', () => {
        expect(() => new OidcVerifier({issuer: ''})).toThrow(/OIDC_ISSUER/);
    });
});

describe('authenticate', () => {
    it('treats every caller as the admin when OIDC is off (the default)', async () => {
        await expect(authenticate({headers: {}})).resolves.toMatchObject({anonymous: true, admin: true, roles: ['process-admin']});
    });
});
