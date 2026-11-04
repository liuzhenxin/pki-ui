export const useUserStore = () => ({ permissions: location.search.includes('denied') ? [] : ['sys:business-application:manage'] });
