<template>
  <div class="ca-config-page">
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">系统配置</h2>
        <p class="page-desc">管理 CA 身份证书、KMC 服务连接及归档策略</p>
      </div>
      <el-button v-hasPermi="['ca:config:get']" icon="Refresh" @click="loadActiveConfig">刷新</el-button>
    </div>
    <el-card shadow="never" class="config-card">

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
              <div class="section-title">
                <span class="section-icon">
                  <el-icon><Setting /></el-icon>
                </span>
                基础信息
              </div>
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
                    <el-input-number
                      v-model="identityForm.validityValue"
                      :min="1"
                      :step="1"
                      :precision="0"
                      controls-position="right"
                      style="flex: 1; min-width: 0"
                    />
                    <el-select v-model="identityForm.validityUnit" style="width: 80px; flex-shrink: 0">
                      <el-option label="年" value="y" />
                      <el-option label="月" value="m" />
                      <el-option label="日" value="d" />
                    </el-select>
                  </div>
                </el-form-item>
              </div>
            </section>

            <section class="config-section">
              <div class="section-title">
                <span class="section-icon"><el-icon><Document /></el-icon></span>
                证书主题
              </div>
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
              <div class="section-title">
                <span class="section-icon"><el-icon><Key /></el-icon></span>
                密钥生成
              </div>
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
                    <el-radio-button value="SDF">SDF</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item v-if="identityForm.signerType === 'PKCS12'" label="密钥密码">
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
              <el-input v-model="kmcForm.kmcBaseUrl" placeholder="http://kmc:3443/api">
                <template #append>
                  <el-button icon="Connection" :loading="testingKmc" @click="testKmcCommunication">KMP通信测试</el-button>
                </template>
              </el-input>
              <div class="form-tip">Docker 部署默认使用容器网络地址：http://kmc:3443/api</div>
            </el-form-item>
            <el-form-item v-if="kmcTestResult" label="测试结果">
              <el-alert
                :title="kmcTestResult.passed ? 'KMP通信测试通过' : 'KMP通信测试未通过'"
                :type="kmcTestResult.passed ? 'success' : 'error'"
                :closable="false"
                show-icon
              >
                <ul class="test-checks">
                  <li v-for="item in kmcTestResult.checks" :key="item.name" :class="{ passed: item.passed, failed: !item.passed }">
                    <span class="check-name">{{ item.name }}</span>
                    <span>{{ item.message || '-' }}</span>
                  </li>
                </ul>
              </el-alert>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="归档策略" name="ARCHIVE_POLICY">
          <!-- 归档统计 -->
          <section class="config-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><DataAnalysis /></el-icon></span>
              归档统计
            </div>
            <div class="archive-stats-cards">
              <div class="stat-card">
                <div class="stat-value">{{ archiveStats.totalArchived ?? '-' }}</div>
                <div class="stat-label">累计归档</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ archiveStats.archivedToday ?? '-' }}</div>
                <div class="stat-label">今日归档</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ archiveStats.archivedThisWeek ?? '-' }}</div>
                <div class="stat-label">本周归档</div>
              </div>
            </div>
          </section>

          <!-- 归档设置 -->
          <section class="config-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Setting /></el-icon></span>
              归档设置
            </div>
            <el-form ref="archiveFormRef" :model="archiveForm" label-width="130px">
              <el-form-item label="启用自动归档">
                <el-switch v-model="archiveForm.enabled" />
                <span class="form-tip">开启后系统每 10 分钟自动归档已过期和已吊销的证书</span>
              </el-form-item>
              <el-form-item label="归档方式">
                <el-select v-model="archiveForm.mode" style="width: 240px" disabled>
                  <el-option label="数据库" value="DATABASE" />
                </el-select>
                <el-tag type="info" size="small" style="margin-left: 10px">文件归档即将上线</el-tag>
              </el-form-item>
              <el-form-item label="保留天数">
                <el-input-number v-model="archiveForm.retentionDays" :min="1" :step="1" controls-position="right" style="width: 240px" />
                <span class="form-tip">超过保留期限的归档记录将被自动清理</span>
              </el-form-item>
            </el-form>
          </section>

          <!-- 手动执行 -->
          <section class="config-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><VideoPlay /></el-icon></span>
              手动执行
            </div>
            <div class="archive-operation">
              <el-button type="primary" icon="VideoPlay" :loading="triggeringArchive" @click="handleTriggerArchive">
                立即执行归档
              </el-button>
              <span class="form-tip">手动触发一次归档任务，处理当前符合条件的所有证书</span>
            </div>
          </section>

          <!-- 最近执行记录 -->
          <section v-if="archiveForm.lastRunTime" class="config-section result-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Clock /></el-icon></span>
              最近执行记录
            </div>
            <div class="last-run-info">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="执行时间">{{ archiveForm.lastRunTime }}</el-descriptions-item>
                <el-descriptions-item label="执行结果">
                  <el-tag :type="archiveForm.lastRunSuccess ? 'success' : 'danger'" size="small">
                    {{ archiveForm.lastRunSuccess ? '成功' : '失败' }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="本次归档">{{ archiveForm.lastRunArchivedCount ?? 0 }} 条</el-descriptions-item>
                <el-descriptions-item label="本次清理">{{ archiveForm.lastRunCleanedUpCount ?? 0 }} 条</el-descriptions-item>
              </el-descriptions>
            </div>
          </section>
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
import { Setting, Document, Key, DataAnalysis, VideoPlay, Clock } from '@element-plus/icons-vue';
import { getCaConfig, saveCaConfig, testCaConfig, getArchiveStats, triggerArchive } from '@/api/ca/config';
import type { CaConfigTestCO, ArchivePolicyStatsCO } from '@/api/ca/config';
import { issueCaIdentityCert, listRootCa } from '@/api/ca/root';
import { listProfile } from '@/api/ca/profile';
import X509Cert from '@/components/X509Cert/index.vue';

const activeType = ref('CA_IDENTITY');
const saving = ref(false);
const testingKmc = ref(false);
const kmcTestResult = ref<CaConfigTestCO>();
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
  kmcBaseUrl: 'http://kmc:3443/api'
});

const archiveForm = reactive<any>({
  id: undefined,
  enabled: true,
  mode: 'DATABASE',
  retentionDays: 3650
});

const archiveStats = reactive<ArchivePolicyStatsCO>({
  totalArchived: undefined,
  archivedToday: undefined,
  archivedThisWeek: undefined
});
const triggeringArchive = ref(false);

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

function normalizeKmcForm(source: any = {}) {
  kmcForm.kmcBaseUrl = source.kmcBaseUrl || source.baseUrl || kmcForm.kmcBaseUrl || 'http://kmc:3443/api';
  if (!kmcForm.kmcBaseUrl) {
    kmcForm.kmcBaseUrl = 'http://kmc:3443/api';
  }
}

function normalizeArchiveMode() {
  if (archiveForm.mode !== 'DATABASE') {
    archiveForm.mode = 'DATABASE';
  }
}

function loadArchiveStats() {
  getArchiveStats().then((response) => {
    Object.assign(archiveStats, response.data || {});
  }).catch(() => {});
}

function handleTriggerArchive() {
  triggeringArchive.value = true;
  triggerArchive()
    .then((response) => {
      ElMessage.success('归档任务执行成功');
      Object.assign(archiveStats, response.data || {});
      loadConfig('ARCHIVE_POLICY');
    })
    .catch(() => {
      ElMessage.error('归档任务执行失败');
    })
    .finally(() => {
      triggeringArchive.value = false;
    });
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
      normalizeKmcForm(parsed);
      kmcTestResult.value = undefined;
    } else if (type === 'ARCHIVE_POLICY') {
      assignForm(archiveForm, parsed, data.id);
      normalizeArchiveMode();
      loadArchiveStats();
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
    delete (payload as any).path;
  } else if (activeType.value === 'KMC_SERVER') {
    normalizeKmcForm(payload);
  }
  const { id, ...config } = payload;
  return {
    id,
    type: activeType.value,
    config: JSON.stringify(config)
  };
}

function buildKmcTestData() {
  normalizeKmcForm(kmcForm);
  const { id, ...config } = kmcForm;
  return {
    id,
    type: 'KMC_SERVER',
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

function testKmcCommunication() {
  if (!String(kmcForm.kmcBaseUrl || '').trim()) {
    ElMessage.warning('请输入KMC服务地址');
    return;
  }
  testingKmc.value = true;
  kmcTestResult.value = undefined;
  testCaConfig(buildKmcTestData())
    .then((response: any) => {
      const result = response.data as CaConfigTestCO;
      kmcTestResult.value = result;
      if (result?.passed) {
        ElMessage.success('KMP通信测试通过');
      } else {
        ElMessage.error('KMP通信测试未通过');
      }
    })
    .finally(() => {
      testingKmc.value = false;
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
  if (identityForm.signerType === 'PKCS12' && !identityForm.password) {
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
.ca-config-page {
  padding: 0;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 16px;
  margin-bottom: 0;
}

.page-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: -0.3px;
}

.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 20px;
}

.config-card {
  margin: 0 20px 20px;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 0 20px 20px;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 0;
    padding: 0 4px;
  }
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  padding: 20px 0 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 8px;
}

.identity-form {
  max-width: 1120px;
}

.config-section {
  padding: 20px 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:first-child {
    padding-top: 12px;
  }
}

.result-section {
  border-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  margin: 0 0 20px;
  padding: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--el-text-color-primary);
  border-bottom: 2px solid var(--el-border-color-light);

  &::after {
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 40px;
    height: 2px;
    content: '';
    background: var(--el-color-primary);
  }
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 14px;
}

.identity-result-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 0;
}

.identity-cert-view {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 20px 24px;
  margin-top: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
  row-gap: 6px;
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
  padding: 10px 14px;
  margin: 4px 0 16px 112px;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.issue-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 2px 0 8px;
}

.identity-cert-info {
  width: 100%;
}

.identity-cert-detail {
  width: 100%;
}

:deep(.identity-form .el-form-item .el-select) {
  width: 100%;
}

:deep(.identity-form .el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

:deep(.identity-form .el-input__wrapper) {
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  transition: box-shadow 0.2s;
}

:deep(.identity-form .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-darker) inset;
}

:deep(.identity-form .el-radio-button__inner) {
  border-radius: 6px;
}

:deep(.identity-form .el-tabs__header) {
  margin-bottom: 18px;
}

.form-tip {
  display: inline-block;
  margin-top: 6px;
  margin-left: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.archive-stats-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
}

.stat-card {
  flex: 1;
  min-width: 140px;
  padding: 20px 24px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
  line-height: 36px;
}

.stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.archive-operation {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.last-run-info {
  max-width: 640px;
}

.test-checks {
  padding-left: 0;
  margin: 8px 0 0;
  list-style: none;
}

.test-checks li {
  display: flex;
  gap: 8px;
  line-height: 22px;
}

.check-name {
  flex: 0 0 88px;
  font-weight: 600;
}

.test-checks .passed {
  color: var(--el-color-success);
}

.test-checks .failed {
  color: var(--el-color-danger);
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
