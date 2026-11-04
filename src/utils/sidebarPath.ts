/** Preserve absolute authorized destinations when menu groups are reorganized. */
export const sidebarDestination = (base: string, route: string) => (route.startsWith('/') ? route : `${base}/${route}`);
