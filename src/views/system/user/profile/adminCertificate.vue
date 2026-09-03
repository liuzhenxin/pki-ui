<template>
  <div v-loading="loading" class="admin-certificate">
    <template v-if="binding.bound">
      <el-alert
        :title="certificateStatus.title"
        :type="certificateStatus.type"
        :description="certificateStatus.description"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <el-descriptions :column="1" border>
        <el-descriptions-item label="证书主题">{{ binding.subjectDn || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发机构">{{ binding.issuerDn || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ binding.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SHA-256 指纹">
          <span class="fingerprint">{{ formatFingerprint(binding.fingerprintSha256) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="算法"> {{ binding.publicKeyAlgorithm || '-' }} / {{ binding.signatureAlgorithm || '-' }} </el-descriptions-item>
        <el-descriptions-item label="有效期"> {{ formatTime(binding.notBefore) }} 至 {{ formatTime(binding.notAfter) }} </el-descriptions-item>
        <el-descriptions-item label="绑定时间">{{ formatTime(binding.bindTime) }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions">
        <el-button type="primary" @click="openDialog">更新证书</el-button>
      </div>
    </template>
    <el-empty v-else description="当前管理员尚未绑定认证证书">
      <el-button type="primary" @click="openDialog">绑定证书</el-button>
    </el-empty>

    <el-dialog v-model="dialogVisible" :title="binding.bound ? '更新管理员证书' : '绑定管理员证书'" width="620px" destroy-on-close>
      <el-alert title="上传后需要使用该证书对应的 USB Key 私钥完成签名，证书才会生效。" type="info" show-icon :closable="false" class="mb-4" />
      <el-form ref="formRef" :model="form" label-width="110px">
        <el-form-item label="证书文件" required>
          <el-upload :auto-upload="false" :limit="1" accept=".cer,.crt,.pem" :on-change="handleFileChange" :on-remove="handleFileRemove">
            <el-button>选择证书</el-button>
            <template #tip><div class="el-upload__tip">支持 PEM 或 DER 格式，文件不超过 64KB</div></template>
          </el-upload>
        </el-form-item>
        <template v-if="candidate">
          <el-divider content-position="left">证书预检结果</el-divider>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="证书主题">{{ candidate.subjectDn }}</el-descriptions-item>
            <el-descriptions-item label="颁发机构">{{ candidate.issuerDn }}</el-descriptions-item>
            <el-descriptions-item label="序列号">{{ candidate.serialNumber }}</el-descriptions-item>
            <el-descriptions-item label="有效期">
              {{ formatTime(candidate.notBefore) }} 至 {{ formatTime(candidate.notAfter) }}
            </el-descriptions-item>
          </el-descriptions>
          <el-divider content-position="left">身份确认</el-divider>
          <el-form-item label="当前密码" required>
            <el-input v-model="form.password" type="password" show-password autocomplete="current-password" />
          </el-form-item>
          <el-form-item label="USB Key PIN" required>
            <el-input v-model="form.pin" type="password" show-password autocomplete="off" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="!candidate" type="primary" :loading="submitting" :disabled="!selectedFile" @click="uploadCandidate"> 上传并校验 </el-button>
        <el-button v-else type="primary" :loading="submitting" @click="proveAndBind"> 签名并{{ binding.bound ? '更新' : '绑定' }} </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import SKFClient from '@/api/skf/skf_api';
import { calculateSm2SignatureDigest, normalizeSm2SignatureForApi } from '@/utils/sm2SignatureDigest';
import {
  createCertificateBindingCandidate,
  getCurrentCertificateBinding,
  verifyCertificateBindingCandidate,
  type CertificateBinding,
  type CertificateBindingCandidate
} from '@/api/auth/certificateBinding';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const selectedFile = ref<File>();
const selectedCertificate = ref('');
const candidate = ref<CertificateBindingCandidate>();
const binding = ref<CertificateBinding>({ bound: false });
const form = reactive({ password: '', pin: '' });

const certificateStatus = computed(() => {
  const expiresAt = binding.value.notAfter ? new Date(binding.value.notAfter).getTime() : 0;
  const remainingDays = expiresAt ? Math.ceil((expiresAt - Date.now()) / 86400000) : 0;
  if (expiresAt && remainingDays < 0) return { title: '证书已过期', type: 'error' as const, description: '请尽快更新管理员证书。' };
  if (expiresAt && remainingDays <= 30) {
    return { title: '证书即将到期', type: 'warning' as const, description: `证书将在 ${remainingDays} 天内到期，请及时更新。` };
  }
  return { title: '管理员证书有效', type: 'success' as const, description: '该证书已通过私钥持有证明并可用于证书认证。' };
});

async function loadBinding() {
  loading.value = true;
  try {
    const response: any = await getCurrentCertificateBinding();
    binding.value = response.data || { bound: false };
  } finally {
    loading.value = false;
  }
}

function openDialog() {
  selectedFile.value = undefined;
  selectedCertificate.value = '';
  candidate.value = undefined;
  form.password = '';
  form.pin = '';
  dialogVisible.value = true;
}

async function handleFileChange(uploadFile: any) {
  const file = uploadFile.raw as File;
  if (!file) return;
  if (file.size > 64 * 1024) {
    ElMessage.error('证书文件不能超过 64KB');
    return;
  }
  selectedFile.value = file;
  selectedCertificate.value = await readCertificate(file);
  candidate.value = undefined;
}

function handleFileRemove() {
  selectedFile.value = undefined;
  selectedCertificate.value = '';
  candidate.value = undefined;
}

async function uploadCandidate() {
  if (!selectedFile.value) return;
  submitting.value = true;
  try {
    const response: any = await createCertificateBindingCandidate(selectedFile.value);
    candidate.value = response.data;
    ElMessage.success('证书校验通过，请使用对应 USB Key 完成签名');
  } finally {
    submitting.value = false;
  }
}

async function proveAndBind() {
  if (!candidate.value || !form.password || !form.pin) {
    ElMessage.warning('请输入当前密码和 USB Key PIN');
    return;
  }
  submitting.value = true;
  const skf = new SKFClient('ws://127.0.0.1:9001');
  try {
    await skf.connect();
    const certificates = await skf.findCertificates('Sign');
    const expected = normalizeCertificate(selectedCertificate.value);
    const certificate = certificates.find((item: any) => normalizeCertificate(item?.cert) === expected);
    if (!certificate) throw new Error('USB Key 中未找到与上传文件一致的签名证书');
    const pinValid = await skf.checkPIN(certificate.key, form.pin);
    if (!pinValid) throw new Error('USB Key PIN 验证失败');
    const signatureDigest = calculateSm2SignatureDigest(selectedCertificate.value, candidate.value.signData, candidate.value.sm2UserId);
    const signature = normalizeSm2SignatureForApi(await skf.signData(certificate.key, signatureDigest));
    const response: any = await verifyCertificateBindingCandidate({
      candidateId: candidate.value.candidateId,
      challengeId: candidate.value.challengeId,
      signature,
      password: form.password
    });
    binding.value = response.data;
    dialogVisible.value = false;
    ElMessage.success(binding.value.bound ? '管理员证书已生效' : '管理员证书绑定成功');
  } catch (error: any) {
    ElMessage.error(error?.message || '管理员证书绑定失败');
  } finally {
    skf.disconnect();
    submitting.value = false;
  }
}

function readCertificate(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取证书文件失败'));
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = '';
      bytes.forEach((value) => (binary += String.fromCharCode(value)));
      resolve(btoa(binary));
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeCertificate(value?: string) {
  return String(value || '')
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '');
}

function formatFingerprint(value?: string) {
  return value
    ? value
        .match(/.{1,2}/g)
        ?.join(':')
        .toUpperCase()
    : '-';
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

onMounted(loadBinding);
</script>

<style scoped>
.admin-certificate {
  min-height: 260px;
}

.actions {
  margin-top: 20px;
  text-align: right;
}

.fingerprint {
  overflow-wrap: anywhere;
  font-family: monospace;
}
</style>
