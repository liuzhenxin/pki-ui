<template>
  <el-button plain icon="Bell" :loading="loading" @click="open">待办上报配置</el-button>
  <el-dialog v-model="visible" title="审核待办上报" width="min(520px, 94vw)" append-to-body>
    <template v-if="preferences">
      <el-alert v-if="!preferences.collectorConfigured" type="warning" :closable="false" show-icon
        title="此 RA 实例尚未配置 OPS 上报连接。" />
      <el-form v-else label-width="170px" :disabled="loading">
        <el-form-item label="审核中心待办">
          <el-switch v-model="preferences.standard" aria-label="上报审核中心待办" />
        </el-form-item>
        <el-form-item label="录入证书待审">
          <el-switch v-model="preferences.publicLedger" :disabled="!preferences.publicAvailable" aria-label="上报录入证书待审" />
        </el-form-item>
        <p>RA 按采集周期上报当前待办数量，告警条件和通知渠道在 OPS 设置。</p>
      </el-form>
    </template>
    <template #footer>
      <el-button :disabled="loading" @click="visible = false">关闭</el-button>
      <el-button v-if="preferences?.collectorConfigured" type="primary" :loading="loading" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getReviewReporting, saveReviewReporting, type ReviewReportingPreferences } from '@/api/ra/reviewReporting';

const visible = ref(false);
const loading = ref(false);
const preferences = ref<ReviewReportingPreferences>();

async function open() {
  if (loading.value) return;
  loading.value = true;
  try {
    const { data } = await getReviewReporting();
    if (!data) return;
    preferences.value = data;
    visible.value = true;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!preferences.value?.collectorConfigured || loading.value) return;
  loading.value = true;
  try {
    await saveReviewReporting(preferences.value.standard, preferences.value.publicLedger);
    visible.value = false;
    ElMessage.success('审核待办上报设置已保存');
  } finally {
    loading.value = false;
  }
}
</script>
