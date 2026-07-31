<template>
  <div class="server">
    <strong>{{ title }}</strong>
    <el-form-item label="服务器地址" :prop="`${prefix}.host`"
      ><el-input v-model.trim="model.host" placeholder="syslog.example.com 或 IP"
    /></el-form-item>
    <div class="row">
      <el-form-item label="端口"><el-input-number v-model="model.port" :min="1" :max="65535" /></el-form-item>
      <el-form-item label="协议"><el-segmented v-model="model.protocol" :options="['UDP', 'TCP', 'TLS']" @change="protocolChanged" /></el-form-item>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { SyslogServerConfig } from '@/api/ops/types';
const props = defineProps<{ title: string; prefix: string }>();
const model = defineModel<SyslogServerConfig>({ required: true });
const protocolChanged = () => {
  if (model.value.protocol === 'TLS' && [514, 601].includes(model.value.port)) model.value.port = 6514;
  if (model.value.protocol !== 'TLS' && model.value.port === 6514) model.value.port = 514;
};
</script>
<style scoped lang="scss">
.server {
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.server strong {
  display: block;
  margin-bottom: 16px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
:deep(.el-input-number),
:deep(.el-segmented) {
  width: 100%;
}
</style>
