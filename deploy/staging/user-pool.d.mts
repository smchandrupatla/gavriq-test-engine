export const STAGING_POOL_PASSWORD: string;
export const STAGING_POOL_OPERATORS: number;

export function ensureStagingUserPool(api: string, options: {
  /** The built-in administrator's password (used to create and repair pool identities). */
  password: string;
  /** The password every pool operator ends up with; at least 12 characters. */
  poolPassword?: string;
  operatorSlots?: number;
  request?: typeof fetch;
  log?: (message: string) => void;
}): Promise<{ created: number; ready: number; repaired: number; retired: number }>;
