<template>
  <div class="kds-alerts">
    <el-card v-loading="loading">
      <template #header><span>告警配置与事件</span></template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />
      <el-descriptions v-if="settings" :column="3" border class="mb">
        <el-descriptions-item label="启用">{{ settings.enabled ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="Webhook 主机">{{ settings.webhookHost || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Webhook">{{ settings.webhookMasked || '-' }}</el-descriptions-item>
        <el-descriptions-item label="超时">{{ settings.timeout }}</el-descriptions-item>
        <el-descriptions-item label="节流">{{ settings.throttle }}</el-descriptions-item>
        <el-descriptions-item label="监控间隔">{{ settings.monitorInterval }}</el-descriptions-item>
      </el-descriptions>
      <el-alert type="info" :closable="false" show-icon title="告警渠道由部署配置管理；页面仅展示脱敏摘要，不提供完整地址。" class="mb" />
      <div class="actions">
        <el-button v-hasPermi="['kds:ops:test']" type="primary" :loading="testing" @click="onTest"> 发送测试告警 </el-button>
        <el-button :loading="loading" @click="refresh">刷新</el-button>
      </div>
      <el-table :data="events" border size="small" class="mt">
        <el-table-column prop="occurredAt" label="时间" min-width="180" />
        <el-table-column prop="severity" label="级别" width="100" />
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column prop="code" label="代码" min-width="150" />
        <el-table-column prop="message" label="消息" min-width="220" />
        <template #empty>暂无告警事件</template>
      </el-table>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getAlertEvents, getAlertSettings, testAlert } from '@/api/kds/ops';
import { toKdsError } from '@/api/kds/client';
import type { AlertEventView, AlertSettings } from '@/types/kds';

const settings = ref<AlertSettings>();
const events = ref<AlertEventView[]>([]);
const loading = ref(false);
const testing = ref(false);
const error = ref('');

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    settings.value = await getAlertSettings();
    const result = await getAlertEvents(20);
    events.value = result.events || [];
  } catch (e) {
    error.value = toKdsError(e).message;
  } finally {
    loading.value = false;
  }
}

async function onTest() {
  testing.value = true;
  try {
    const result = await testAlert();
    if (result.delivered) {
      ElMessage.success('测试告警已投递');
    } else {
      ElMessage.warning(`测试告警未投递：${result.message || result.code}`);
    }
    await refresh();
  } catch (e) {
    ElMessage.error(toKdsError(e).message);
  } finally {
    testing.value = false;
  }
}

onMounted(refresh);
</script>
<style scoped>
.kds-alerts {
  padding: 20px;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 16px;
}
.actions {
  margin-bottom: 8px;
}
</style>
