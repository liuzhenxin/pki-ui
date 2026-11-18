import { onActivated, onDeactivated } from 'vue';

export function useRaListRefreshOnReturn(refresh: () => unknown) {
  let hasLeft = false;
  onDeactivated(() => { hasLeft = true; });
  onActivated(() => {
    if (!hasLeft) return;
    hasLeft = false;
    return refresh();
  });
}
