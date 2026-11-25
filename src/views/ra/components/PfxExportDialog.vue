<template>
  <el-dialog v-model="pfxOpen" title="下载 PFX 证书包" width="600px" append-to-body
    :close-on-click-modal="false" :close-on-press-escape="!pfxPending" :show-close="!pfxPending" @close="clearPfx">
    <el-form label-width="112px" @submit.prevent>
      <el-form-item label="私钥">
        <el-input v-model="pfxForm.privateKey" type="textarea" :rows="6" placeholder="粘贴 PEM 格式私钥"
          autocomplete="off" :disabled="pfxPending" @input="onPrivateKeyInput" />
        <input ref="pfxKeyFileInput" type="file" accept=".key,.pem" hidden @change="loadPfxKeyFile" />
        <el-button link type="primary" :disabled="pfxPending" @click="pfxKeyFileInput?.click()">选择私钥文件</el-button>
      </el-form-item>
      <el-form-item label="私钥密码">
        <el-input v-model="pfxForm.keyPassword" type="password" show-password placeholder="加密私钥请填写"
          autocomplete="off" :disabled="pfxPending" @input="pfxVerified = false" />
      </el-form-item>
      <el-form-item v-if="pfxVerified" label="PFX 密码">
        <el-input v-model="pfxForm.password" type="password" show-password placeholder="可以留空"
          autocomplete="new-password" :disabled="pfxPending" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="pfxPending" @click="pfxOpen = false">取消</el-button>
      <el-button type="primary" :loading="pfxPending" :disabled="!pfxForm.privateKey.trim()"
        @click="submitPfx">{{ pfxVerified ? '下载 PFX' : '验证私钥' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import type { PfxExportFields } from '@/api/ra/cert';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';

const pfxOpen = defineModel<boolean>({ required: true });
const props = defineProps<{
  certId?: string | number;
  serialNumber?: string;
  requestPfx: (id: string | number, form: PfxExportFields, verifyOnly: boolean) => Promise<unknown>;
}>();
const emit = defineEmits<{ download: [blob: Blob, filename: string] }>();
const pfxPending = ref(false);
const pfxKeyFileInput = ref<HTMLInputElement>();
const pfxVerified = ref(false);
const pfxForm = reactive({ privateKey: '', keyPassword: '', password: '' });
let session = 0;
let fileRead = 0;

function onPrivateKeyInput() {
  fileRead++;
  pfxVerified.value = false;
}

watch([pfxOpen, () => props.certId], clearPfx, { flush: 'sync' });

async function loadPfxKeyFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !pfxOpen.value || pfxPending.value) return;
  onPrivateKeyInput();
  pfxForm.privateKey = '';
  const currentRead = fileRead;
  const isCurrent = () => currentRead === fileRead && pfxOpen.value && !pfxPending.value;
  try {
    const pem = await file.text();
    if (!isCurrent()) return;
    pfxForm.privateKey = pem;
    pfxVerified.value = false;
  } catch {
    if (isCurrent()) ElMessage.error('无法读取私钥文件');
  }
}

function clearPfx() {
  session++;
  fileRead++;
  pfxPending.value = false;
  pfxForm.privateKey = '';
  pfxForm.keyPassword = '';
  pfxForm.password = '';
  pfxVerified.value = false;
}

async function submitPfx() {
  const certId = props.certId;
  if (!certId || !pfxOpen.value || pfxPending.value || !pfxForm.privateKey.trim()) return;
  const currentSession = session;
  const isCurrent = () => currentSession === session && pfxOpen.value;
  const serialNumber = props.serialNumber;
  const verifyOnly = !pfxVerified.value;
  pfxPending.value = true;
  try {
    const response = await props.requestPfx(certId, { ...pfxForm }, verifyOnly);
    if (!isCurrent()) return;
    if (verifyOnly) {
      pfxVerified.value = true;
      ElMessage.success('私钥与证书匹配');
    } else {
      const blob = await certificateDownloadBlob(response, 'application/x-pkcs12', 'RA_CERT_DOWNLOAD_');
      if (!isCurrent()) return;
      emit('download', blob, `${serialNumber || 'ra-cert'}.pfx`);
      pfxOpen.value = false;
    }
  } catch (error) {
    if (!isCurrent()) return;
    ElMessage.error(error instanceof Error ? error.message : verifyOnly ? '私钥验证失败' : 'PFX 下载失败');
  } finally {
    if (isCurrent()) pfxPending.value = false;
  }
}
</script>
