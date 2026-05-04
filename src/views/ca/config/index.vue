<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>系统配置</span>
          <el-button v-hasPermi="['ca:config:get']" icon="Refresh" @click="loadActiveConfig">刷新</el-button>
        </div>
      </template>

      <el-tabs v-model="activeType" @tab-change="handleTabChange">
        <el-tab-pane label="CA身份配置" name="CA_IDENTITY">
          <section v-if="showIdentityCertView" class="config-section result-section identity-cert-view">
            <div class="section-title identity-result-title">
              <span>CA 身份证书</span>
              <el-tag type="success" effect="light">已配置</el-tag>
            </div>
            <el-form label-width="112px">
              <el-form-item label="身份证书">
                <el-input v-model="identityForm.certPem" type="textarea" :rows="8" readonly />
              </el-form-item>
              <el-form-item label="证书信息">
                <div class="identity-cert-detail">
                  <el-button
                    link
                    type="primary"
                    :icon="showIdentityCertDetail ? 'Hide' : 'View'"
                    @click="showIdentityCertDetail = !showIdentityCertDetail"
                  >
                    {{ showIdentityCertDetail ? '隐藏证书' : '显示证书' }}
                  </el-button>
                  <X509Cert v-if="showIdentityCertDetail" class="identity-cert-info" :certPem="identityForm.certPem" />
                </div>
              </el-form-item>
            </el-form>
            <div class="issue-actions">
              <el-button type="primary" icon="RefreshRight" @click="startUpdateIdentityCert">更新证书</el-button>
            </div>
          </section>

          <el-form v-else ref="identityFormRef" :model="identityForm" label-width="112px" class="identity-form">
            <section class="config-section">
              <div class="section-title">基础信息</div>
              <div class="form-grid">
                <el-form-item label="签发CA">
                  <el-select v-model="identityForm.rootId" placeholder="请选择签发CA" style="width: 100%" clearable>
                    <el-option v-for="item in rootOptions" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="证书模板">
                  <el-select
                    v-model="identityForm.profileId"
                    placeholder="请选择证书模板"
                    style="width: 100%"
                    clearable
                    @change="handleProfileChange"
                  >
                    <el-option v-for="item in profileOptions" :key="item.id" :label="formatProfileLabel(item)" :value="item.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="证书有效期">
                  <div class="validity-input">
                    <el-input-number v-model="identityForm.validityValue" :min="1" :step="1" :precision="0" controls-position="right" />
                    <el-select v-model="identityForm.validityUnit" class="validity-unit">
                      <el-option label="年" value="y" />
                      <el-option label="月" value="m" />
                      <el-option label="日" value="d" />
                    </el-select>
                  </div>
                </el-form-item>
              </div>
            </section>

            <section class="config-section">
              <div class="section-title">证书主题</div>
              <div class="form-grid subject-grid">
                <el-form-item v-for="field in subjectFields" :key="field.key" :label="field.label">
                  <el-input
                    v-model="field.value"
                    :placeholder="field.required ? `请输入${field.label}` : `${field.label}（可选）`"
                    @input="syncSubjectFromFields"
                  />
                </el-form-item>
              </div>
              <div class="subject-preview">{{ identityForm.subject }}</div>
            </section>

            <section class="config-section">
              <div class="section-title">密钥生成</div>
              <div class="form-grid">
                <el-form-item label="密钥算法">
                  <el-select v-model="identityForm.algo" style="width: 100%">
                    <el-option label="SM2" value="SM2" />
                    <el-option label="RSA2048" value="RSA" />
                    <el-option label="ECC P-256" value="ECC" />
                  </el-select>
                </el-form-item>
                <el-form-item label="存储方式">
                  <el-radio-group v-model="identityForm.signerType">
                    <el-radio-button value="PKCS12">PKCS12</el-radio-button>
                    <el-radio-button value="JKS">JKS</el-radio-button>
                    <el-radio-button value="SDF">SDF</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item v-if="identityForm.signerType === 'PKCS12' || identityForm.signerType === 'JKS'" label="密钥密码">
                  <el-input v-model="identityForm.password" type="password" show-password placeholder="请输入密钥库密码" />
                </el-form-item>
                <el-form-item v-if="identityForm.signerType === 'SDF'" label="密钥索引">
                  <el-input-number v-model="identityForm.keyIndex" :min="1" controls-position="right" style="width: 100%" />
                </el-form-item>
              </div>
            </section>

            <section class="config-section result-section">
              <div class="section-title identity-result-title">
                <span>{{ hasIdentityCert ? '更新身份证书' : '签发身份证书' }}</span>
              </div>
              <div class="issue-actions">
                <el-button v-if="hasIdentityCert" @click="cancelUpdateIdentityCert">取消</el-button>
                <el-button type="success" icon="Stamp" :loading="issuingIdentityCert" @click="issueIdentityCert">签发并保存</el-button>
              </div>
            </section>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="KMC服务配置" name="KMC_SERVER">
          <el-form ref="kmcFormRef" :model="kmcForm" label-width="130px">
            <el-form-item label="启用KMC">
              <el-switch v-model="kmcForm.enabled" />
            </el-form-item>
            <el-form-item label="服务地址">
              <el-input v-model="kmcForm.baseUrl" placeholder="http://localhost:8080" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="归档策略" name="ARCHIVE_POLICY">
          <el-form ref="archiveFormRef" :model="archiveForm" label-width="130px">
            <el-form-item label="启用归档">
              <el-switch v-model="archiveForm.enabled" />
            </el-form-item>
            <el-form-item label="归档方式">
              <el-select v-model="archiveForm.mode" placeholder="请选择归档方式" style="width: 100%">
                <el-option label="数据库" value="DATABASE" />
                <el-option label="文件系统" value="FILE" />
              </el-select>
            </el-form-item>
            <el-form-item label="保留天数">
              <el-input-number v-model="archiveForm.retentionDays" :min="1" controls-position="right" style="width: 100%" />
            </el-form-item>
            <el-form-item label="归档路径">
              <el-input v-model="archiveForm.path" placeholder="/data/ca/archive" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div v-if="showSaveAction" class="action-bar">
        <el-button v-hasPermi="['ca:config:save']" type="primary" :loading="saving" icon="Check" @click="saveActiveConfig">保存配置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="CaConfig" lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { getCaConfig, saveCaConfig } from '@/api/ca/config';
import { issueCaIdentityCert, listRootCa } from '@/api/ca/root';
import { listProfile } from '@/api/ca/profile';
import X509Cert from '@/components/X509Cert/index.vue';

const activeType = ref('CA_IDENTITY');
const saving = ref(false);
const issuingIdentityCert = ref(false);
const identityIssueMode = ref(false);
const showIdentityCertDetail = ref(false);
const rootOptions = ref<any[]>([]);
const profileOptions = ref<any[]>([]);
const subjectFields = ref<any[]>([]);
const hasIdentityCert = computed(() => Boolean(identityForm.certPem || identityForm.serialNumber));
const showIdentityCertView = computed(() => activeType.value === 'CA_IDENTITY' && hasIdentityCert.value && !identityIssueMode.value);
const showSaveAction = computed(() => activeType.value !== 'CA_IDENTITY' || identityIssueMode.value || !hasIdentityCert.value);

const identityForm = reactive<any>({
  id: undefined,
  rootId: undefined,
  profileId: undefined,
  subject: 'C=CN,O=LiuZX,OU=CA,CN=CA Identity',
  validity: '5y',
  validityValue: 5,
  validityUnit: 'y',
  algo: 'SM2',
  signerType: 'PKCS12',
  password: '',
  keyIndex: 1,
  certPem: '',
  signerConf: '',
  certSubject: '',
  issuer: '',
  serialNumber: '',
  notBefore: '',
  notAfter: ''
});

const kmcForm = reactive<any>({
  id: undefined,
  enabled: false,
  baseUrl: ''
});

const archiveForm = reactive<any>({
  id: undefined,
  enabled: true,
  mode: 'DATABASE',
  retentionDays: 3650,
  path: ''
});

const archiveModeValues = ['DATABASE', 'FILE'];

const activePayload = computed(() => {
  if (activeType.value === 'KMC_SERVER') {
    return kmcForm;
  }
  if (activeType.value === 'ARCHIVE_POLICY') {
    return archiveForm;
  }
  return identityForm;
});

function parseConfig(config?: string) {
  if (!config) {
    return {};
  }
  try {
    return JSON.parse(config);
  } catch {
    ElMessage.warning('配置内容不是合法JSON，已显示原始内容');
    return {};
  }
}

function assignForm(target: any, source: any, id?: string | number) {
  Object.keys(target).forEach((key) => {
    if (key !== 'id') {
      target[key] = source[key] ?? target[key];
    }
  });
  target.id = id;
}

function normalizeArchiveMode() {
  if (!archiveModeValues.includes(archiveForm.mode)) {
    archiveForm.mode = 'DATABASE';
  }
}

function syncValidityFieldsFromValue() {
  const matched = String(identityForm.validity || '')
    .trim()
    .match(/^(\d+)([ymd])$/i);
  if (!matched) {
    return;
  }
  identityForm.validityValue = Number(matched[1]);
  identityForm.validityUnit = matched[2].toLowerCase();
}

function syncValidityValueFromFields() {
  const value = Number(identityForm.validityValue);
  if (!Number.isInteger(value) || value < 1) {
    ElMessage.warning('请输入证书有效期');
    return false;
  }
  identityForm.validity = `${value}${identityForm.validityUnit || 'y'}`;
  return true;
}

function loadConfig(type: string) {
  return getCaConfig(type).then((response) => {
    const data = response.data || ({ type, config: '' } as any);
    const parsed = parseConfig(data.config);
    if (type === 'KMC_SERVER') {
      assignForm(kmcForm, parsed, data.id);
    } else if (type === 'ARCHIVE_POLICY') {
      assignForm(archiveForm, parsed, data.id);
      normalizeArchiveMode();
    } else {
      assignForm(identityForm, parsed, data.id);
      syncValidityFieldsFromValue();
      refreshSubjectFields();
      identityIssueMode.value = !hasIdentityCert.value;
      showIdentityCertDetail.value = false;
    }
  });
}

function loadActiveConfig() {
  loadConfig(activeType.value);
}

function loadRoots() {
  listRootCa({ pageNum: 1, pageSize: 100 }).then((response: any) => {
    const data = response.data;
    rootOptions.value = data?.records || data?.rows || data?.list || (Array.isArray(data) ? data : []);
    if (!identityForm.rootId && rootOptions.value.length > 0) {
      identityForm.rootId = rootOptions.value[0].id;
    }
  });
}

function loadProfiles() {
  listProfile({}).then((response: any) => {
    profileOptions.value = response.data || [];
    if (!identityForm.profileId) {
      const defaultProfile = profileOptions.value.find((item) => item.name === '通用证书模板') || profileOptions.value[0];
      identityForm.profileId = defaultProfile?.id;
    }
    refreshSubjectFields();
  });
}

function formatProfileLabel(profile: any) {
  return profile?.type ? `${profile.name} (${profile.type})` : profile?.name;
}

function handleProfileChange() {
  refreshSubjectFields();
}

function getSelectedProfile() {
  return profileOptions.value.find((item) => String(item.id) === String(identityForm.profileId));
}

function parseProfileSubjectRdns(profile: any) {
  if (!profile?.conf) {
    return [];
  }
  try {
    const conf = JSON.parse(stripJsonComments(profile.conf));
    return Array.isArray(conf?.subject?.rdns) ? conf.subject.rdns : [];
  } catch {
    return [];
  }
}

function stripJsonComments(json: string) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < json.length; index += 1) {
    const char = json[index];
    const next = json[index + 1];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (!inString && char === '/' && next === '/') {
      while (index < json.length && json[index] !== '\n') {
        index += 1;
      }
      result += '\n';
      continue;
    }
    result += char;
  }
  return result;
}

function getRdnLabel(rdn: any) {
  const description = rdn?.type?.description;
  return description?.length <= 16 ? description.toUpperCase() : description || rdn?.type?.oid || 'RDN';
}

function normalizeRdnKey(label: string) {
  const upper = label.toUpperCase();
  if (upper === 'SERIALNUMBER') {
    return 'SERIALNUMBER';
  }
  return upper;
}

function splitDn(subject: string) {
  const parts: string[] = [];
  let current = '';
  let escaped = false;
  for (const char of subject || '') {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      current += char;
      escaped = true;
    } else if (char === ',') {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }
  return parts;
}

function parseSubjectMap(subject: string) {
  const subjectMap: Record<string, string> = {};
  splitDn(subject).forEach((part) => {
    const index = part.indexOf('=');
    if (index > 0) {
      const key = normalizeRdnKey(part.slice(0, index).trim());
      subjectMap[key] = part
        .slice(index + 1)
        .trim()
        .replace(/\\([,+"<>;=\\])/g, '$1');
    }
  });
  return subjectMap;
}

function defaultSubjectValue(key: string) {
  if (key === 'C') {
    return 'CN';
  }
  if (key === 'O') {
    return 'LiuZX';
  }
  if (key === 'OU') {
    return 'CA';
  }
  if (key === 'CN') {
    return 'CA Identity';
  }
  return '';
}

function refreshSubjectFields() {
  const rdns = parseProfileSubjectRdns(getSelectedProfile());
  const subjectMap = parseSubjectMap(identityForm.subject);
  subjectFields.value = rdns.map((rdn: any) => {
    const label = getRdnLabel(rdn);
    const key = normalizeRdnKey(label);
    return {
      key,
      label,
      required: rdn.minOccurs !== 0,
      value: subjectMap[key] ?? defaultSubjectValue(key)
    };
  });
  if (subjectFields.value.length === 0) {
    subjectFields.value = [
      { key: 'C', label: 'C', required: true, value: subjectMap.C ?? 'CN' },
      { key: 'O', label: 'O', required: true, value: subjectMap.O ?? 'LiuZX' },
      { key: 'OU', label: 'OU', required: false, value: subjectMap.OU ?? 'CA' },
      { key: 'CN', label: 'CN', required: true, value: subjectMap.CN ?? 'CA Identity' }
    ];
  }
  syncSubjectFromFields();
}

function escapeDnValue(value: string) {
  return String(value || '')
    .trim()
    .replace(/([,+"<>;=\\])/g, '\\$1');
}

function syncSubjectFromFields() {
  identityForm.subject = subjectFields.value
    .filter((field) => String(field.value || '').trim())
    .map((field) => `${field.key}=${escapeDnValue(field.value)}`)
    .join(',');
}

function validateSubjectFields() {
  const emptyField = subjectFields.value.find((field) => field.required && !String(field.value || '').trim());
  if (emptyField) {
    ElMessage.warning(`请输入${emptyField.label}`);
    return false;
  }
  syncSubjectFromFields();
  return true;
}

function handleTabChange() {
  loadActiveConfig();
}

function buildSaveData() {
  const payload = activePayload.value;
  if (activeType.value === 'CA_IDENTITY') {
    syncSubjectFromFields();
    if (!syncValidityValueFromFields()) {
      throw new Error('INVALID_VALIDITY');
    }
  } else if (activeType.value === 'ARCHIVE_POLICY') {
    normalizeArchiveMode();
  }
  const { id, ...config } = payload;
  return {
    id,
    type: activeType.value,
    config: JSON.stringify(config)
  };
}

function saveActiveConfig() {
  let data;
  try {
    data = buildSaveData();
  } catch (error: any) {
    if (error?.message === 'INVALID_VALIDITY') {
      return;
    }
    ElMessage.error('配置格式不正确');
    return;
  }

  saving.value = true;
  saveCaConfig(data)
    .then(() => {
      ElMessage.success('保存成功');
      loadActiveConfig();
    })
    .finally(() => {
      saving.value = false;
    });
}

function startUpdateIdentityCert() {
  identityIssueMode.value = true;
  showIdentityCertDetail.value = false;
}

function cancelUpdateIdentityCert() {
  identityIssueMode.value = false;
  showIdentityCertDetail.value = false;
  loadConfig('CA_IDENTITY');
}

function issueIdentityCert() {
  if (!identityForm.rootId) {
    ElMessage.warning('请选择签发CA');
    return;
  }
  if (!identityForm.profileId) {
    ElMessage.warning('请选择证书模板');
    return;
  }
  if (!validateSubjectFields()) {
    return;
  }
  if (!syncValidityValueFromFields()) {
    return;
  }
  if ((identityForm.signerType === 'PKCS12' || identityForm.signerType === 'JKS') && !identityForm.password) {
    ElMessage.warning('请输入密钥密码');
    return;
  }
  if (identityForm.signerType === 'SDF' && !identityForm.keyIndex) {
    ElMessage.warning('请输入SDF密钥索引');
    return;
  }
  const updating = hasIdentityCert.value;
  issuingIdentityCert.value = true;
  issueCaIdentityCert({
    co: {
      rootId: identityForm.rootId,
      profileId: identityForm.profileId,
      subject: identityForm.subject,
      validity: identityForm.validity,
      certName: 'CA身份证书',
      algo: identityForm.algo,
      signerType: identityForm.signerType,
      password: identityForm.signerType === 'SDF' ? undefined : identityForm.password,
      keyIndex: identityForm.signerType === 'SDF' ? identityForm.keyIndex : undefined
    }
  })
    .then((response: any) => {
      const data = response.data || {};
      identityForm.certPem = data.cert || '';
      identityForm.certSubject = data.subject || '';
      identityForm.issuer = data.issuer || '';
      identityForm.serialNumber = data.serialNumber || '';
      identityForm.notBefore = data.notBefore || '';
      identityForm.notAfter = data.notAfter || '';
      identityForm.signerConf = data.signerConf || '';
      ElMessage.success(updating ? '更新成功' : '签发成功');
      return saveCaConfig({
        id: identityForm.id,
        type: 'CA_IDENTITY',
        config: JSON.stringify({ ...identityForm, id: undefined })
      });
    })
    .then(() => {
      identityIssueMode.value = false;
      showIdentityCertDetail.value = false;
      return loadConfig('CA_IDENTITY');
    })
    .finally(() => {
      issuingIdentityCert.value = false;
    });
}

loadConfig('CA_IDENTITY');
loadRoots();
loadProfiles();

watch(
  () => identityForm.profileId,
  () => refreshSubjectFields()
);
</script>

<style scoped lang="scss">
.p-2 {
  padding: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.identity-form {
  max-width: 1120px;
}

.config-section {
  padding: 18px 0 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.config-section:first-child {
  padding-top: 8px;
}

.result-section {
  border-bottom: 0;
}

.section-title {
  position: relative;
  margin: 0 0 16px;
  padding-left: 10px;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--el-text-color-primary);
}

.section-title::before {
  position: absolute;
  top: 3px;
  left: 0;
  width: 3px;
  height: 14px;
  content: '';
  background: var(--el-color-primary);
  border-radius: 2px;
}

.identity-result-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
}

.subject-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.validity-input {
  display: flex;
  width: 100%;
  gap: 8px;
}

.validity-input :deep(.el-input-number) {
  flex: 1;
  min-width: 0;
}

.validity-unit {
  width: 88px;
}

.subject-preview {
  padding: 9px 12px;
  margin: 0 0 14px 112px;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.issue-actions {
  display: flex;
  justify-content: flex-end;
  padding: 2px 0 8px;
}

.identity-cert-info {
  width: 100%;
}

.identity-cert-detail {
  width: 100%;
}

@media (max-width: 960px) {
  .form-grid,
  .subject-grid {
    grid-template-columns: 1fr;
  }

  .subject-preview {
    margin-left: 0;
  }
}
</style>
