<template>
  <el-drawer
    :model-value="modelValue"
    title="添加服务 CA"
    size="min(800px, 100vw)"
    destroy-on-close
    :show-close="!busy"
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    @close="close"
  >
    <el-steps :active="step" finish-status="success" align-center class="wizard-steps">
      <el-step title="签发者证书" /><el-step title="响应者和来源" /><el-step title="验证" /><el-step title="启用" />
    </el-steps>
    <el-alert
      v-if="draft?.publishedVersion"
      type="info"
      :closable="false"
      show-icon
      class="wizard-alert"
      :title="`当前已启用版本 ${draft.publishedVersion}；草稿修改和验证期间继续使用已启用配置。`"
    />
    <el-alert
      v-if="step >= 2 && !canVerify"
      type="warning"
      :closable="false"
      show-icon
      class="wizard-alert"
      title="验证和启用需要同时具备来源保存与探测权限。"
    />
    <template v-if="step === 0">
      <el-alert
        class="wizard-alert"
        type="info"
        :closable="false"
        show-icon
        title="该向导用于新接入的 CA；已通过旧流程登记签发者的 CA 暂不支持迁移。"
      />
      <el-form label-width="145px">
        <el-form-item label="服务 CA ID">
          <span>{{ form.caId || '保存证书后自动生成' }}</span>
        </el-form-item>
        <el-form-item label="CA 签发者证书" required>
          <div class="certificate-input">
            <el-input v-model="form.issuerPem" type="textarea" :rows="9" placeholder="粘贴 CA 公钥证书 PEM，或选择证书文件" />
            <input ref="fileInput" class="file-input" type="file" accept=".pem,.crt,.cer,.der" @change="readCertificate" />
            <el-button class="file-button" @click="fileInput?.click()">选择证书文件</el-button>
            <div class="help">支持 PEM 或 DER 公钥证书。请勿上传私钥。</div>
          </div>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="draft?.sourceConfigured"
        type="warning"
        :closable="false"
        show-icon
        title="修改证书会清除当前草稿的数据源和验证结果，已启用版本不受影响。"
      />
    </template>
    <template v-else-if="step === 1">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="wizard-alert"
        title="连接地址和密码引用不会回显；继续编辑已有草稿时请重新填写。密码引用应指向服务端环境变量或配置项。"
      />
      <el-form label-width="145px">
        <el-form-item label="来源 CA 标识" required>
          <el-input v-model="form.sourceCaId" maxlength="255" placeholder="填写证书状态库或 LDAP 中的 CA 标识" />
        </el-form-item>
        <el-form-item label="响应者" required>
          <el-select v-model="form.responderId" filterable allow-create default-first-option placeholder="选择响应者或输入完整响应者 ID">
            <el-option v-for="item in responderOptions" :key="item.id" :value="item.id" :label="`${item.name}（${item.id}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源名称"><el-input v-model="form.name" placeholder="例如：CA 证书状态库" /></el-form-item>
        <el-form-item label="来源类型"><el-segmented v-model="form.type" :options="['DB', 'LDAP']" /></el-form-item>
        <template v-if="form.type === 'DB'">
          <el-form-item label="数据库 URL" required><el-input v-model="form.db.url" placeholder="jdbc:mysql://host:3306/database" /></el-form-item>
          <el-form-item label="只读用户名" required><el-input v-model="form.db.username" /></el-form-item>
          <el-form-item label="密码引用" required><el-input v-model="form.db.passwordRef" placeholder="服务端环境变量或配置项名称" /></el-form-item>
          <el-row :gutter="12">
            <el-col v-for="field in dbFields" :key="field.key" :span="12"
              ><el-form-item :label="field.label"><el-input v-model="form.db[field.key]" /></el-form-item
            ></el-col>
          </el-row>
        </template>
        <template v-else>
          <el-form-item label="LDAP 地址" required><el-input v-model="form.ldap.url" placeholder="ldaps://directory.example.com" /></el-form-item>
          <el-form-item label="Base DN" required><el-input v-model="form.ldap.baseDn" /></el-form-item>
          <el-form-item label="Bind DN" required><el-input v-model="form.ldap.bindDn" /></el-form-item>
          <el-form-item label="密码引用" required><el-input v-model="form.ldap.passwordRef" /></el-form-item>
          <el-form-item label="搜索过滤器" required><el-input v-model="form.ldap.searchFilter" /></el-form-item>
          <el-row :gutter="12">
            <el-col v-for="field in ldapFields" :key="field.key" :span="12"
              ><el-form-item :label="field.label"><el-input v-model="form.ldap[field.key]" /></el-form-item
            ></el-col>
          </el-row>
          <el-form-item label="存在性模式"><el-switch v-model="form.ldap.presenceMode" /></el-form-item>
          <el-form-item label="连接超时（毫秒）"><el-input-number v-model="form.ldap.connectTimeout" :min="1" :max="30000" /></el-form-item>
          <el-form-item label="读取超时（毫秒）"><el-input-number v-model="form.ldap.readTimeout" :min="1" :max="30000" /></el-form-item>
        </template>
        <el-divider content-position="left">已知证书验证样本</el-divider>
        <el-form-item label="证书序列号" required><el-input v-model="form.sampleSerialHex" placeholder="十六进制序列号，不含 0x" /></el-form-item>
        <el-form-item label="预期状态" required
          ><el-radio-group v-model="form.expectedStatus"
            ><el-radio value="GOOD">GOOD</el-radio><el-radio value="REVOKED">REVOKED</el-radio></el-radio-group
          ></el-form-item
        >
      </el-form>
    </template>
    <template v-else-if="step === 2">
      <el-alert type="info" :closable="false" show-icon title="系统将检查 CA 证书、响应者签名授权、数据源连接，并核对已知证书的实际状态。" />
      <el-descriptions :column="1" border class="wizard-summary">
        <el-descriptions-item label="CA ID">{{ form.caId }}</el-descriptions-item>
        <el-descriptions-item label="响应者 ID">{{ draft?.responderId || form.responderId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="来源类型">{{ draft?.sourceType || form.type }}</el-descriptions-item>
        <el-descriptions-item label="验证样本"
          >{{ draft?.sampleSerialHex || form.sampleSerialHex }} / {{ draft?.expectedStatus || form.expectedStatus }}</el-descriptions-item
        >
        <el-descriptions-item label="草稿版本">{{ draft?.version }}</el-descriptions-item>
      </el-descriptions>
    </template>
    <template v-else>
      <el-result v-if="isPublished" icon="success" title="服务 CA 已启用" :sub-title="`CA ${form.caId} 的版本 ${draft?.version} 已发布。`" />
      <el-result
        v-else
        icon="success"
        title="验证通过"
        :sub-title="`CA ${form.caId} 的草稿版本 ${draft?.version} 已通过验证；点击启用后才会处理请求。`"
      />
    </template>
    <template #footer>
      <el-button :disabled="busy" @click="close">{{ isPublished ? '完成' : '关闭' }}</el-button>
      <el-button v-if="step === 3 && isPublished" :disabled="busy" @click="step = 1">修改数据源</el-button>
      <el-button v-if="step > 0 && !isPublished" :disabled="busy" @click="step--">上一步</el-button>
      <el-button v-if="step === 0" type="primary" :loading="busy" @click="saveCertificate">保存并继续</el-button>
      <el-button v-if="step === 1" type="primary" :loading="busy" @click="saveSource">保存并继续</el-button>
      <el-button v-if="step === 2" type="primary" :loading="busy" :disabled="!canVerify" @click="validate">验证草稿</el-button>
      <el-button v-if="step === 3 && !isPublished" type="primary" :loading="busy" :disabled="!canVerify" @click="publish">启用服务 CA</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { getServiceCaDraft, publishServiceCaDraft, saveServiceCaDraft, validateServiceCaDraft } from '@/api/ocsp/serviceCa';
import type { ServiceCaDraft } from '@/api/ocsp/serviceCa';
import { normalizeOcspCaId, normalizeOptionalOcspId } from '@/utils/ocspIdentifier';
import { pageOcspResponders } from '@/api/ocsp/responder';
import auth from '@/plugins/auth';

const props = defineProps<{ modelValue: boolean; initialCaId?: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void; (event: 'saved'): void }>();
const fileInput = ref<HTMLInputElement>();
const busy = ref(false);
const step = ref(0);
const draft = ref<ServiceCaDraft | null>(null);
const canVerify = computed(() => auth.hasPermiAnd(['ocsp:source:save', 'ocsp:source:probe']));
const responderOptions = ref<Array<{ id: string; name: string }>>([]);
let responderRequest = 0;
const loadedIssuer = ref('');
const initialForm = () => ({
  caId: '',
  sourceCaId: '',
  responderId: '',
  issuerPem: '',
  name: '',
  type: 'DB' as 'DB' | 'LDAP',
  sampleSerialHex: '',
  expectedStatus: 'GOOD' as 'GOOD' | 'REVOKED',
  db: {
    url: '',
    username: '',
    passwordRef: '',
    certTable: 'ca_cert',
    archiveCertTable: '',
    serialNumberColumn: 'serial_number',
    caIdColumn: 'root_id',
    statusColumn: 'cert_status',
    isRevokedColumn: 'is_revoked',
    revocationTimeColumn: 'revocation_time',
    revocationReasonColumn: 'revocation_reason',
    notBeforeColumn: 'not_before',
    notAfterColumn: 'not_after',
    delFlagColumn: 'del_flag'
  },
  ldap: {
    url: '',
    baseDn: '',
    bindDn: '',
    passwordRef: '',
    searchFilter: '(&(objectClass=pkiCertificate)(certificateSerialNumber={serialNumber})(caId={caId}))',
    serialNumberAttribute: 'certificateSerialNumber',
    caIdAttribute: 'caId',
    statusAttribute: 'certificateStatus',
    revocationTimeAttribute: 'revocationTime',
    revocationReasonAttribute: 'revocationReason',
    connectTimeout: 3000,
    readTimeout: 5000,
    presenceMode: false
  }
});
const form = reactive(initialForm());
const dbFields: Array<{ key: keyof typeof form.db; label: string }> = [
  { key: 'certTable', label: '证书表' },
  { key: 'archiveCertTable', label: '归档表' },
  { key: 'serialNumberColumn', label: '序列号字段' },
  { key: 'caIdColumn', label: 'CA 字段' },
  { key: 'statusColumn', label: '状态字段' },
  { key: 'isRevokedColumn', label: '吊销标志字段' },
  { key: 'revocationTimeColumn', label: '吊销时间字段' },
  { key: 'revocationReasonColumn', label: '吊销原因字段' },
  { key: 'notBeforeColumn', label: '生效时间字段' },
  { key: 'notAfterColumn', label: '失效时间字段' },
  { key: 'delFlagColumn', label: '删除标志字段' }
];
const ldapFields: Array<{
  key: 'serialNumberAttribute' | 'caIdAttribute' | 'statusAttribute' | 'revocationTimeAttribute' | 'revocationReasonAttribute';
  label: string;
}> = [
  { key: 'serialNumberAttribute', label: '序列号属性' },
  { key: 'caIdAttribute', label: 'CA 属性' },
  { key: 'statusAttribute', label: '状态属性' },
  { key: 'revocationTimeAttribute', label: '吊销时间属性' },
  { key: 'revocationReasonAttribute', label: '吊销原因属性' }
];
const sameVersion = (left: unknown, right: unknown) => left != null && right != null && String(left) === String(right);
const isPublished = computed(() => !!draft.value && sameVersion(draft.value.publishedVersion, draft.value.version));
const versionOf = (value: unknown): number => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version <= 0) throw new Error('草稿版本无效，请重新加载');
  return version;
};
const close = () => {
  emit('update:modelValue', false);
};
const reset = () => {
  Object.assign(form, initialForm());
  draft.value = null;
  loadedIssuer.value = '';
  step.value = 0;
  busy.value = false;
  responderOptions.value = [];
  responderRequest++;
};
const loadResponders = async () => {
  if (!auth.hasPermi('ocsp:responder')) return;
  const current = responderRequest;
  try {
    const page = await pageOcspResponders({ pageNum: 1, pageSize: 100 });
    if (current !== responderRequest || !props.modelValue) return;
    responderOptions.value = (page?.records || []).flatMap((item) => {
      if (item.status !== 'ACTIVE' || item.id == null) return [];
      try {
        return [{ id: normalizeOcspCaId(item.id), name: item.name }];
      } catch {
        return [];
      }
    });
  } catch {
    if (current === responderRequest) responderOptions.value = [];
  }
};
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      reset();
      return;
    }
    reset();
    void loadResponders();
    if (props.initialCaId) {
      form.caId = props.initialCaId;
      await loadDraft();
    }
  }
);
const loadDraft = async () => {
  try {
    const caId = normalizeOcspCaId(form.caId);
    busy.value = true;
    const loaded = await getServiceCaDraft(caId);
    if (!loaded) {
      ElMessage.info('该 CA 尚无草稿，请先上传签发者证书');
      return;
    }
    versionOf(loaded.version);
    if (!loaded.issuerPem) throw new Error('草稿证书读取失败');
    draft.value = loaded;
    form.caId = caId;
    form.issuerPem = loaded.issuerPem;
    loadedIssuer.value = loaded.issuerPem;
    form.responderId = loaded.responderId || '';
    form.sourceCaId = loaded.sourceCaId || (loaded.sourceConfigured ? caId : '');
    form.type = loaded.sourceType === 'LDAP' ? 'LDAP' : 'DB';
    form.sampleSerialHex = loaded.sampleSerialHex || '';
    form.expectedStatus = loaded.expectedStatus === 'REVOKED' ? 'REVOKED' : 'GOOD';
    step.value =
      sameVersion(loaded.publishedVersion, loaded.version) || sameVersion(loaded.verifiedVersion, loaded.version)
        ? 3
        : loaded.sourceConfigured && loaded.sampleConfigured
          ? 2
          : 1;
  } catch (error: any) {
    ElMessage.error(error?.message || '读取草稿失败');
  } finally {
    busy.value = false;
  }
};
const readCertificate = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 48000) throw new Error('证书文件过大');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    if (/PRIVATE KEY/i.test(text)) throw new Error('证书文件不得包含私钥');
    if (text.includes('-----BEGIN CERTIFICATE-----')) form.issuerPem = text;
    else {
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const base64 =
        btoa(binary)
          .match(/.{1,64}/g)
          ?.join('\n') || '';
      form.issuerPem = `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----\n`;
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '读取证书失败');
  }
};
const saveCertificate = async () => {
  try {
    const caId = draft.value ? normalizeOcspCaId(form.caId) : undefined;
    const pem = form.issuerPem.trim();
    if (!pem.includes('-----BEGIN CERTIFICATE-----') || /PRIVATE KEY/i.test(pem) || pem.length > 65536)
      throw new Error('请输入有效的 CA 公钥证书 PEM');
    if (draft.value && pem === loadedIssuer.value.trim()) {
      step.value = 1;
      return;
    }
    if (draft.value?.publishedVersion != null) throw new Error('暂不支持替换已启用 CA 的签发者证书');
    busy.value = true;
    draft.value = await saveServiceCaDraft({ caId, expectedVersion: draft.value ? versionOf(draft.value.version) : 0, issuerPem: pem });
    versionOf(draft.value.version);
    form.caId = normalizeOcspCaId(draft.value.caId);
    loadedIssuer.value = pem;
    step.value = 1;
    emit('saved');
  } catch (error: any) {
    ElMessage.error(error?.message || '保存证书失败');
  } finally {
    busy.value = false;
  }
};
const saveSource = async () => {
  try {
    if (!draft.value) throw new Error('请先保存 CA 证书');
    const caId = normalizeOcspCaId(form.caId);
    const sourceCaId = form.sourceCaId.trim();
    if (!sourceCaId || sourceCaId.length > 255) throw new Error('请输入有效的来源 CA 标识');
    const responderId = normalizeOptionalOcspId(form.responderId);
    if (!responderId) throw new Error('请输入响应者 ID');
    const serial = form.sampleSerialHex.trim().toUpperCase();
    if (!/^[0-9A-F]{1,40}$/.test(serial) || /^0+$/.test(serial)) throw new Error('请输入有效的十六进制证书序列号');
    if (form.type === 'DB' && (!form.db.url.trim() || !form.db.username.trim() || !form.db.passwordRef.trim()))
      throw new Error('请填写数据库 URL、用户名和密码引用');
    if (
      form.type === 'LDAP' &&
      (!form.ldap.url.trim() ||
        !form.ldap.baseDn.trim() ||
        !form.ldap.bindDn.trim() ||
        !form.ldap.passwordRef.trim() ||
        !form.ldap.searchFilter.trim())
    )
      throw new Error('请填写 LDAP 地址、Base DN、Bind DN、密码引用和过滤器');
    const source = {
      caId,
      sourceCaId,
      responderId,
      name: form.name.trim(),
      type: form.type,
      enabled: true,
      db: form.type === 'DB' ? { ...form.db } : undefined,
      ldap: form.type === 'LDAP' ? { ...form.ldap } : undefined
    };
    busy.value = true;
    draft.value = await saveServiceCaDraft({
      caId,
      expectedVersion: versionOf(draft.value.version),
      responderId,
      issuerPem: form.issuerPem.trim(),
      source,
      sampleSerialHex: serial,
      expectedStatus: form.expectedStatus
    });
    versionOf(draft.value.version);
    step.value = 2;
    emit('saved');
  } catch (error: any) {
    ElMessage.error(error?.message || '保存数据源失败');
  } finally {
    busy.value = false;
  }
};
const validate = async () => {
  try {
    if (!draft.value) throw new Error('请先保存草稿');
    busy.value = true;
    const expected = versionOf(draft.value.version);
    const result = await validateServiceCaDraft(form.caId, expected);
    if (!sameVersion(result.verifiedVersion, expected)) throw new Error('草稿验证版本不匹配，请重新加载');
    draft.value = result;
    step.value = 3;
    emit('saved');
  } catch (error: any) {
    ElMessage.error(error?.message || '草稿验证失败');
  } finally {
    busy.value = false;
  }
};
const publish = async () => {
  try {
    if (!draft.value) throw new Error('请先验证草稿');
    const expected = versionOf(draft.value.version);
    if (!sameVersion(draft.value.verifiedVersion, expected)) throw new Error('当前版本尚未验证');
    busy.value = true;
    const result = await publishServiceCaDraft(form.caId, expected);
    if (!sameVersion(result.publishedVersion, expected)) throw new Error('发布版本不匹配，请重新加载');
    draft.value = result;
    ElMessage.success('服务 CA 已启用');
    emit('saved');
  } catch (error: any) {
    ElMessage.error(error?.message || '启用失败');
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.wizard-steps {
  margin: 4px 0 24px;
}
.wizard-alert {
  margin-bottom: 16px;
}
.wizard-summary {
  margin-top: 20px;
}
.certificate-input {
  width: 100%;
}
.file-input {
  display: none;
}
.file-button {
  margin-top: 8px;
}
.help {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 6px;
}
</style>
