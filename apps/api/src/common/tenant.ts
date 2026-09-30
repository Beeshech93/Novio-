import { MemberRole } from '@prisma/client';

/** Resolved per request by AuthGuard. Every tenant query MUST filter by businessId. */
export interface TenantContext {
  userId: string;
  platformRole: 'USER' | 'SUPER_ADMIN';
  businessId: string;
  role: MemberRole;
  permissions: string[];
}

export interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  tenant?: TenantContext;
}
