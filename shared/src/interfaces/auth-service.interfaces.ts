import { UserRole } from "../entities/user.entity";

export interface JwtPayload {
    sub: string;
    role: UserRole;
    email: string;
    jti?: string;
}

export interface RefreshJwtPayload {
    sub: string;
    jti: string;
}

export interface LoginSession {
    userId: string;
    email: string;
    verified: boolean;
}

export interface TokenLookup {
    userId: string;
    role: UserRole;
}

export interface SessionData {
    userId: string;
    email: string;
    role: UserRole;
    accessToken: string;
    createdAt: string;
}

export interface EmailPayload {
    to: string;
    subject: string;
    template: string;
    context: Record<string, unknown>;
}

export interface Tokens {
    accessToken: string;
    refreshToken: string;
}

