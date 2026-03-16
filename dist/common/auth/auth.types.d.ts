export type UserRole = 'admin' | 'operator' | 'viewer';
export interface AuthUser {
    userId: string;
    companyId: string;
    role: UserRole;
    email: string;
    name: string;
}
export interface JwtPayload {
    sub: string;
    companyId: string;
    role: UserRole;
    email: string;
    name: string;
}
