<template>
  <el-button v-if="canNotify" :loading="submitting" :disabled="submittedId === certId" @click="requestNotification">
    {{ submittedId === certId ? '通知任务已提交' : '发送签发通知' }}
  </el-button>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, ref } from 'vue';
import auth from '@/plugins/auth';
import { requestRaIssueNotification } from '@/api/ra/certIssue';

const props = defineProps<{ certId: string | number }>();
const canNotify = computed(() => auth.hasPermi('ra:admin'));
const submitting = ref(false);
const submittedId = ref<string | number>();

async function requestNotification() {
  const certId = props.certId;
  if (submitting.value || submittedId.value === certId) return;
  submitting.value = true;
  try {
    try {
      await ElMessageBox.confirm('确认向证书使用者发送签发成功邮件？', '发送签发通知', { type: 'info' });
    } catch {
      return;
    }
    await requestRaIssueNotification(certId);
    submittedId.value = certId;
    ElMessage.success('签发通知任务已提交');
  } finally {
    submitting.value = false;
  }
}
</script>
