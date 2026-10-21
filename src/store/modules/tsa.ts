import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getTsaHealth, listTsaCertificates, type TsaCertificate, type TsaHealth } from '@/api/tsa';

export const useTsaStore = defineStore('tsa', () => {
  const loading = ref(false);
  const error = ref('');
  const health = ref<TsaHealth>();
  const certificates = ref<TsaCertificate[]>([]);

  const refresh = async () => {
    loading.value = true;
    error.value = '';
    try {
      const [healthResult, certificateResult] = await Promise.all([getTsaHealth(), listTsaCertificates()]);
      health.value = healthResult as unknown as TsaHealth;
      certificates.value = (certificateResult as unknown as TsaCertificate[]) || [];
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'TSA 状态加载失败';
      throw cause;
    } finally {
      loading.value = false;
    }
  };

  return { loading, error, health, certificates, refresh };
});
