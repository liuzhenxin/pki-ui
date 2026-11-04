<template>
  <div class="hsm-page hsm-initialization">
    <HsmPageHeader title="初始化状态" description="查询设备初始化的记录与批次，确认后续配置工作。" />
    <el-card>
      <template #header><span>密码机初始化状态</span></template>
      <el-alert type="warning" :closable="false" show-icon title="设备授权接口与审批流程尚未验证，初始化写操作暂未开放。" />
      <el-alert v-if="error" class="status-message" type="error" :closable="false" :title="error" show-icon />
      <div v-loading="loading" class="status-content">
        <el-descriptions v-if="status" :column="2" border>
          <el-descriptions-item label="记录状态">{{ initializationLabel(status.state) }}</el-descriptions-item>
          <el-descriptions-item label="初始化批次">{{ status.currentAttemptId || '未开始' }}</el-descriptions-item>
          <el-descriptions-item label="历史批次">{{ status.attemptCount }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else-if="!loading && !error" description="尚未查询状态" />
      </div>
      <p class="hsm-muted">以上为服务端保存的进度；实时设备状态需要真机联调后接入。</p>
      <el-divider />
      <h3>初始化与通信配置</h3>
      <p class="hsm-muted">首次初始化可以不配置证书；后续需要 SSL 通信时再配置。证书配置与设备初始化就绪独立管理。</p>
      <p class="hsm-muted">管理员、操作员各支持 3 或 5 把 UKey，可分别配置。请到 UKey 身份页面查看任命与认证状态。</p>
      <div class="actions">
        <el-button v-hasPermi="['hsm:init:view']" :loading="loading" @click="refresh">刷新状态</el-button>
        <el-tooltip content="需要已验证的设备 UKey 授权及审批流程">
          <span><el-button v-hasPermi="['hsm:init:manage']" type="primary" disabled>开始初始化</el-button></span>
        </el-tooltip>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { initializationLabel } from '@/utils/hsmPresentation';
import HsmPageHeader from '../components/HsmPageHeader.vue';
import '../styles/product.css';
import { getInitializationStatus, type InitializationStatus } from '@/api/hsm/initialization';

const status = ref<InitializationStatus>();
const loading = ref(false);
const error = ref('');

async function refresh() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  status.value = undefined;
  try {
    const response = await getInitializationStatus();
    status.value = response.data;
  } catch {
    error.value = '状态查询失败，请检查登录权限、服务连接后重试。';
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);
</script>
<style scoped>
.hsm-initialization {
  padding: 20px;
}
.status-message,
.status-content,
.actions {
  margin-top: 24px;
}
.status-content {
  min-height: 80px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
