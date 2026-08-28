<template>
  <div class="ocsp-csr-panel">
    <el-form-item label="证书来源">
      <el-radio-group :model-value="certSource" :disabled="hsmMode" @update:model-value="onCertSourceChange">
        <el-radio-button value="CSR">CSR 申请</el-radio-button>
        <el-radio-button value="PEM">粘贴证书</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <p v-if="hsmMode" class="csr-hint">HSM 响应者请粘贴已签发的签名证书 PEM，私钥与 PIN 不在本页配置。</p>

    <template v-if="showCsr">
      <el-form-item label="通用名称" required>
        <el-input v-model="csrForm.commonName" placeholder="例如：OCSP Responder" />
      </el-form-item>
      <el-form-item label="组织名称">
        <el-input v-model="csrForm.organization" placeholder="例如：LiuZX" />
      </el-form-item>
      <el-form-item label="国家代码">
        <el-input v-model="csrForm.country" maxlength="2" placeholder="CN" />
      </el-form-item>
      <el-form-item label="密钥别名">
        <el-input v-model="csrForm.alias" placeholder="ocsp-responder-key" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" :disabled="!name.trim()" @click="generateCsr">
          {{ csr.csrPending ? '重新生成 CSR' : '生成 CSR' }}
        </el-button>
      </el-form-item>

      <div v-if="csr.csrPending && csr.csrPem" class="csr-box">
        <div class="form-section-title">待 CA 离线签发</div>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="私钥仅保存在 OCSP 服务端。请将 CSR 交给 CA 签发 OCSP 签名证书（须含数字签名用途），再导入证书。重新生成会使旧 CSR 失效。"
        />
        <el-form-item label="CSR 主题">
          <el-input :model-value="csr.subject" readonly />
        </el-form-item>
        <el-form-item label="CSR PEM">
          <el-input :model-value="csr.csrPem" type="textarea" :rows="8" readonly />
          <div class="csr-actions">
            <el-button @click="copyCsr">复制 CSR</el-button>
            <el-button @click="downloadCsr">下载 CSR</el-button>
          </div>
        </el-form-item>
        <el-form-item label="签发证书">
          <el-input
            v-model="issuedPem"
            type="textarea"
            :rows="6"
            placeholder="粘贴 CA 签发的 OCSP 响应者证书 PEM"
          />
        </el-form-item>
        <el-form-item label="证书链">
          <el-input v-model="chainPem" type="textarea" :rows="4" placeholder="可选：中间 CA 与根 CA PEM" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="importCertificate">导入并绑定证书</el-button>
        </el-form-item>
      </div>
    </template>

    <el-form-item v-else label="证书 PEM" :required="true">
      <el-input
        :model-value="signerCert"
        type="textarea"
        :rows="10"
        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
        @update:model-value="emit('update:signerCert', $event)"
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { assertSafeSignerCert } from '@/api/ocsp/common';
import { generateOcspResponderCsr, getOcspResponderCsr, importOcspResponderCertificate } from '@/api/ocsp/responder';
import type { OcspResponderCsr } from '@/api/ocsp/types';

const DB_SIGNER_CONF = '{\n  "keyAlias": "ocsp-responder-key",\n  "algorithm": "SM3withSM2",\n  "keyStoreRef": "ocsp-db"\n}';

const props = defineProps<{
  name: string;
  signerType: string;
  signerCert: string;
  signerConf: string;
  certSource: 'CSR' | 'PEM';
}>();

const emit = defineEmits<{
  'update:signerCert': [value: string];
  'update:signerConf': [value: string];
  'update:certSource': [value: 'CSR' | 'PEM'];
}>();

const loading = ref(false);
const issuedPem = ref('');
const chainPem = ref('');
const csr = reactive<OcspResponderCsr>({
  csrPending: false,
  csrPem: '',
  subject: '',
  algorithm: '',
  alias: '',
  status: ''
});
const csrForm = reactive({
  commonName: 'OCSP Responder',
  organization: 'LiuZX',
  country: 'CN',
  alias: 'ocsp-responder-key'
});

const hsmMode = computed(() => (props.signerType || '').toUpperCase() === 'HSM');
const showCsr = computed(() => !hsmMode.value && props.certSource === 'CSR');

const applyCsr = (data?: OcspResponderCsr | null) => {
  csr.csrPending = Boolean(data?.csrPending && data?.csrPem);
  csr.csrPem = data?.csrPem || '';
  csr.subject = data?.subject || '';
  csr.algorithm = data?.algorithm || '';
  csr.alias = data?.alias || '';
  csr.status = data?.status || '';
  if (data?.alias) {
    csrForm.alias = data.alias;
  }
};

const loadPending = async () => {
  const responderName = (props.name || '').trim();
  if (!responderName || hsmMode.value) {
    applyCsr(null);
    return;
  }
  try {
    applyCsr(await getOcspResponderCsr(responderName));
  } catch (error) {
    applyCsr(null);
  }
};

const onCertSourceChange = (value: 'CSR' | 'PEM') => {
  emit('update:certSource', value === 'PEM' ? 'PEM' : 'CSR');
};

const generateCsr = async () => {
  const responderName = (props.name || '').trim();
  if (!responderName) {
    ElMessage.warning('请先填写响应者名称');
    return;
  }
  if (!csrForm.commonName.trim()) {
    ElMessage.warning('请填写通用名称');
    return;
  }
  if (csr.csrPending) {
    await ElMessageBox.confirm('重新生成后，当前 CSR 对应的已签发证书将无法导入。确认继续吗？', '重新生成 CSR', {
      type: 'warning',
      confirmButtonText: '确认重新生成',
      cancelButtonText: '取消'
    });
  }
  loading.value = true;
  try {
    const data = await generateOcspResponderCsr({
      name: responderName,
      commonName: csrForm.commonName.trim(),
      organization: csrForm.organization.trim(),
      country: csrForm.country.trim(),
      alias: csrForm.alias.trim() || 'ocsp-responder-key'
    });
    applyCsr(data);
    emit('update:signerConf', DB_SIGNER_CONF);
    ElMessage.success('CSR 已生成，请交由 CA 离线签发');
  } finally {
    loading.value = false;
  }
};

const importCertificate = async () => {
  const responderName = (props.name || '').trim();
  if (!responderName) {
    ElMessage.warning('请先填写响应者名称');
    return;
  }
  let certificatePem = '';
  try {
    certificatePem = assertSafeSignerCert(issuedPem.value);
  } catch (error: any) {
    ElMessage.error(error.message || '请粘贴 CA 签发的证书 PEM');
    return;
  }
  if (chainPem.value.includes('PRIVATE KEY')) {
    ElMessage.error('证书链不得包含私钥');
    return;
  }
  loading.value = true;
  try {
    const imported = await importOcspResponderCertificate({
      name: responderName,
      certificatePem,
      certificateChainPem: chainPem.value.trim() || undefined
    });
    emit('update:signerCert', imported.signerCert || certificatePem);
    emit('update:signerConf', imported.signerConf || DB_SIGNER_CONF);
    emit('update:certSource', 'PEM');
    applyCsr({ ...csr, csrPending: false });
    issuedPem.value = '';
    chainPem.value = '';
    ElMessage.success('证书已导入，签名配置已指向 ocsp-db');
  } finally {
    loading.value = false;
  }
};

const copyCsr = async () => {
  try {
    await navigator.clipboard.writeText(csr.csrPem || '');
    ElMessage.success('CSR 已复制');
  } catch (error) {
    ElMessage.error('浏览器未允许复制，请手动选择 CSR 文本');
  }
};

const downloadCsr = () => {
  const blob = new Blob([csr.csrPem || ''], { type: 'application/pkcs10' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(props.name || 'ocsp-responder').trim()}.csr.pem`;
  link.click();
  URL.revokeObjectURL(url);
};

watch(
  () => props.signerType,
  (type) => {
    if ((type || '').toUpperCase() === 'HSM' && props.certSource !== 'PEM') {
      emit('update:certSource', 'PEM');
    }
  },
  { immediate: true }
);

watch(
  () => props.name,
  () => {
    loadPending();
  },
  { immediate: true }
);
</script>

<style scoped>
.csr-hint {
  margin: -8px 0 12px 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  font-size: 13px;
}

.csr-box {
  margin: 8px 0 12px;
  padding: 16px 16px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.csr-box :deep(.el-alert) {
  margin-bottom: 16px;
}

.form-section-title {
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1;
}

.csr-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
