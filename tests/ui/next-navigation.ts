import { vi } from 'vitest';

export const routerPush = vi.fn();
export function useRouter() {
  return { push: routerPush };
}
