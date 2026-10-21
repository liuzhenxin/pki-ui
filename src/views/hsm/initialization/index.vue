<template>
  <div class="hsm-initialization">
    <el-card>
      <template #header><span>密码机初始化</span></template>
      <el-alert type="warning" :closable="false" show-icon title="初始化会修改真实密码机状态，请确认设备连接和操作权限。" />
      <el-steps :active="activeStep" finish-status="success" class="steps">
        <el-step title="设备连接" />
        <el-step title="网络配置" />
        <el-step title="设备密钥" />
        <el-step title="主管 UKey" />
        <el-step title="站点证书" />
      </el-steps>
      <el-descriptions v-if="status" :column="2" border>
        <el-descriptions-item label="设备状态">{{ status.state }}</el-descriptions-item>
        <el-descriptions-item label="初始化批次">{{ status.currentAttemptId || '未开始' }}</el-descriptions-item>
        <el-descriptions-item label="历史批次">{{ status.attemptCount }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions">
        <el-button :loading="loading" type="primary" @click="start">开始初始化</el-button>
        <el-button :loading="loading" @click="refresh">刷新状态</el-button>
      </div>
      <el-form v-if="attemptId" label-width="120px" class="device-form">
        <el-form-item label="设备密钥口令"><el-input v-model="deviceSecret" type="password" show-password autocomplete="new-password" /></el-form-item>
        <el-form-item><el-button type="primary" :loading="loading" @click="submitDeviceKey">初始化设备密钥</el-button></el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { beginInitialization, getInitializationStatus, initializeDeviceKey, type InitializationStatus } from '@/api/hsm/initialization';
const status = ref<InitializationStatus>(); const loading = ref(false); const attemptId = ref(''); const deviceSecret = ref('');
const activeStep = computed(() => ({ UNINITIALIZED: 0, DEVICE_CONNECTED: 1, NETWORK_CONFIGURED: 2, DEVICE_KEY_INITIALIZED: 3, SUPERVISORS_INITIALIZED: 4, READY: 5 }[status.value?.state || 'UNINITIALIZED'] ?? 0));
async function refresh() { status.value = await getInitializationStatus(); attemptId.value = status.value.currentAttemptId || ''; }
async function start() { await ElMessageBox.confirm('确认开始真实密码机初始化？', '安全确认'); loading.value = true; try { const result: any = await beginInitialization(); attemptId.value = result.id; await refresh(); ElMessage.success('初始化批次已创建'); } finally { loading.value = false; } }
async function submitDeviceKey() { if (!deviceSecret.value) return ElMessage.warning('请输入设备密钥口令'); loading.value = true; try { await initializeDeviceKey({ attemptId: attemptId.value, deviceSecret: deviceSecret.value }); deviceSecret.value = ''; await refresh(); ElMessage.success('设备密钥初始化成功'); } finally { loading.value = false; } }
onMounted(refresh);
</script>
<style scoped>.hsm-initialization{padding:20px}.steps{margin:32px 0}.actions{margin:24px 0}.device-form{max-width:600px}</style>
