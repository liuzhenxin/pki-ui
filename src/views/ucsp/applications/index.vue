<template>
  <section class="applications">
    <header class="page-head">
      <div>
        <h1>应用接入</h1>
        <p>为业务应用配置调用凭据、服务授权和配额。</p>
      </div>
      <el-button type="primary" :disabled="busy" @click="openRegistration">注册应用</el-button>
    </header>
    <el-card shadow="never">
      <form class="toolbar" @submit.prevent="loadList(0, search.trim())">
        <el-input v-model="search" maxlength="120" clearable aria-label="应用名称或 ID" placeholder="搜索应用名称或 ID" />
        <el-button native-type="submit" :disabled="loading">查询</el-button>
        <el-button :disabled="loading" @click="loadList(offset)">刷新</el-button>
      </form>
      <el-alert v-if="listError" :title="listError" type="error" :closable="false" show-icon />
      <el-table v-loading="loading" :data="items" empty-text="暂无应用" row-key="application.applicationId">
        <el-table-column label="应用名称" min-width="230">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetails(row.application.applicationId)">{{ row.application.name }}</el-button>
            <div class="id">{{ row.application.applicationId }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="115">
          <template #default="{ row }">
            <el-tag :type="!row.application.enabled ? 'info' : row.grantCount ? 'success' : 'warning'">
              {{ !row.application.enabled ? '已停用' : row.grantCount ? '已授权' : '待授权' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="服务授权" width="110">
          <template #default="{ row }">{{ row.grantCount }} 项</template>
        </el-table-column>
        <el-table-column label="调用配额" min-width="155">
          <template #default="{ row }">{{ quotaLabel(row.quota) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetails(row.application.applicationId)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-button :disabled="loading || offset === 0" @click="loadList(offset - 50)">上一页</el-button>
        <span>第 {{ offset / 50 + 1 }} 页</span>
        <el-button :disabled="loading || !hasMore" @click="loadList(offset + 50)">下一页</el-button>
      </div>
    </el-card>

    <el-drawer v-model="detailsOpen" :title="selected?.application.name || '应用详情'" size="min(740px, 100vw)" :before-close="closeDetails">
      <div v-loading="detailsLoading" class="details">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon />
        <div v-if="selected" class="detail-top">
          <div class="id">{{ selected.application.applicationId }}</div>
          <el-button :disabled="busy || editing" @click="loadDetails(selected.application.applicationId)">刷新详情</el-button>
          <el-button v-if="selected.application.enabled" :disabled="busy || stale || editing" type="danger" plain @click="suspend"
            >停用应用</el-button
          >
        </div>
        <el-tabs v-if="selected" v-model="tab" :before-leave="canLeaveTab">
          <el-tab-pane label="授权与配额" name="policy">
            <template v-if="!editing">
              <div class="section-head">
                <h2>服务授权</h2>
                <el-button v-if="selected.application.enabled" type="primary" :disabled="busy || stale" @click="editPolicy">配置授权与配额</el-button>
              </div>
              <el-table :data="selected.activeGrants" empty-text="暂无有效授权">
                <el-table-column prop="serviceId" label="服务 ID" min-width="165" show-overflow-tooltip />
                <el-table-column prop="operation" label="操作" min-width="115" />
                <el-table-column prop="algorithm" label="算法" width="95" />
                <el-table-column prop="objectId" label="逻辑对象" min-width="130" show-overflow-tooltip />
                <el-table-column v-if="selected.application.enabled" label="操作" width="70">
                  <template #default="{ row }"
                    ><el-button link type="danger" :disabled="busy || stale" @click="revoke(row)">撤销</el-button></template
                  >
                </el-table-column>
              </el-table>
              <div class="section-head quota">
                <h2>应用配额</h2>
                <span>{{ quotaLabel(selected.quota) }}</span>
              </div>
            </template>
            <form v-else class="policy-form" @submit.prevent="save">
              <div class="form-grid">
                <label>请求上限<el-input-number v-model="maxRequests" :min="1" :max="1000000" :precision="0" aria-label="请求上限" /></label>
                <label>窗口（秒）<el-input-number v-model="windowSeconds" :min="1" :max="3600" :precision="0" aria-label="窗口（秒）" /></label>
              </div>
              <div class="section-head">
                <h2>授权条目</h2>
                <el-button :disabled="grants.length >= 128" @click="grants.push(emptyGrant())">添加授权</el-button>
              </div>
              <p class="hint">时间戳、SM4、SM2 和 RSA 授权使用服务预先配置的逻辑对象。</p>
              <div v-for="(grant, index) in grants" :key="grant.key" class="grant">
                <label>
                  密码服务
                  <el-select
                    v-model="grant.option"
                    filterable
                    :loading="optionsLoading"
                    :aria-label="'密码服务 ' + (index + 1)"
                    @change="grant.objectId = ''"
                  >
                    <el-option v-for="option in options" :key="optionKey(option)" :label="optionLabel(option)" :value="optionKey(option)" />
                  </el-select>
                </label>
                <label>
                  逻辑对象
                  <el-input
                    v-if="optionMap.get(grant.option)?.objectId"
                    :model-value="optionMap.get(grant.option)?.objectId"
                    readonly
                    :aria-label="'逻辑对象 ' + (index + 1)"
                  />
                  <el-input v-else v-model="grant.objectId" maxlength="128" :aria-label="'逻辑对象 ' + (index + 1)" />
                </label>
                <el-button text type="danger" @click="grants.splice(index, 1)">移除</el-button>
              </div>
              <el-button v-if="moreOptions" :disabled="optionsLoading" @click="loadOptions(false)">加载更多服务</el-button>
              <div class="actions">
                <el-button :disabled="busy" @click="editing = false">取消</el-button>
                <el-button type="primary" native-type="submit" :loading="busy" :disabled="stale || optionsLoading || !grants.length"
                  >保存策略</el-button
                >
              </div>
            </form>
          </el-tab-pane>
          <el-tab-pane label="调用凭据" name="credential">
            <dl class="credential-fields">
              <dt>APP Key</dt>
              <dd>
                <code>{{ selected.application.appKey }}</code>
              </dd>
              <dt>凭据版本</dt>
              <dd>{{ selected.application.credentialVersion }}</dd>
              <dt>认证方式</dt>
              <dd>HTTPS + HTTP Basic</dd>
            </dl>
            <el-button v-if="selected.application.enabled" :disabled="busy || stale" @click="rotate">轮换凭据</el-button>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog v-model="registrationOpen" title="注册应用" width="min(480px, 95vw)" :close-on-click-modal="!busy" :before-close="closeRegistration">
      <form class="registration" @submit.prevent="register">
        <label>应用名称<el-input v-model="name" maxlength="120" aria-label="应用名称" placeholder="例如档案管理系统" /></label>
        <p class="hint">注册后签发调用凭据，配置授权后即可调用服务。</p>
        <el-alert v-if="registrationError" :title="registrationError" type="error" :closable="false" show-icon />
        <div class="actions">
          <el-button :disabled="busy" @click="registrationOpen = false">取消</el-button>
          <el-button type="primary" native-type="submit" :loading="busy" :disabled="!name.trim()">注册并签发凭据</el-button>
        </div>
      </form>
    </el-dialog>
    <el-dialog
      :model-value="!!credential"
      title="调用凭据"
      width="min(590px, 95vw)"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <p class="hint">APP Secret 仅在此处显示一次，请保存到受控的凭据存储。</p>
      <dl v-if="credential" class="credential-fields">
        <dt>APP Key</dt>
        <dd>
          <code>{{ credential.appKey }}</code>
        </dd>
        <dt>APP Secret</dt>
        <dd>
          <code>{{ credential.appSecret }}</code>
        </dd>
      </dl>
      <template #footer><el-button type="primary" @click="clearCredential">已安全保存</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  applicationError,
  getApplication,
  listApplications,
  listGrantOptions,
  registerApplication,
  revokeApplicationGrant,
  rotateCredential,
  saveApplicationPolicy,
  suspendApplication
} from '@/api/ucsp/applications';
import type { ApplicationView, Credential, Grant, Quota, ServiceOption, Summary } from '@/api/ucsp/applications';

const items = ref<Summary[]>([]);
const search = ref('');
const query = ref('');
const offset = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const listError = ref('');
const selected = ref<ApplicationView>();
const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailError = ref('');
const tab = ref('policy');
const editing = ref(false);
const stale = ref(false);
const busy = ref(false);
const registrationOpen = ref(false);
const registrationError = ref('');
const name = ref('');
const credential = ref<Credential>();
const options = ref<ServiceOption[]>([]);
const moreOptions = ref(false);
const optionsLoading = ref(false);
const optionOffset = ref(0);
const grants = ref<{ key: number; option: string; objectId: string }[]>([]);
const maxRequests = ref<number>(100);
const windowSeconds = ref<number>(60);
const optionKey = (option: ServiceOption) => JSON.stringify([option.serviceId, option.operation, option.algorithm, option.objectId]);
const operationLabels: Record<string, string> = { RANDOM: '随机数', ENCRYPT: '加密', DECRYPT: '解密', SIGN: '签名', VERIFY: '验签' };
const optionLabel = (option: ServiceOption) =>
  [
    option.name || option.serviceId,
    ['ENCRYPT', 'DECRYPT', 'SIGN', 'VERIFY'].includes(option.operation)
      ? `${option.algorithm.startsWith('RSA-') ? 'RSA' : option.algorithm.startsWith('SM4') ? 'SM4' : option.algorithm} ${operationLabels[option.operation]}`
      : operationLabels[option.operation] || option.operation,
    option.algorithm,
    option.objectId
  ]
    .filter(Boolean)
    .join(' / ');
const optionMap = computed(() => new Map(options.value.map((item) => [optionKey(item), item])));
const quotaLabel = (quota: Quota | null) => (quota ? `${quota.maxRequests} 次 / ${quota.windowSeconds} 秒` : '待配置');
let nextKey = 0;
let detailRequest = 0;

const emptyGrant = () => ({ key: ++nextKey, option: '', objectId: '' });
const canLeaveTab = () => !editing.value && !busy.value;
const closeDetails = (done: () => void) => {
  if (!busy.value) {
    ++detailRequest;
    editing.value = false;
    done();
  }
};
const closeRegistration = (done: () => void) => {
  if (!busy.value) done();
};
const clearCredential = () => (credential.value = undefined);

async function loadList(next: number, term = query.value) {
  if (loading.value) return;
  loading.value = true;
  listError.value = '';
  try {
    const page = await listApplications(next, term);
    items.value = page.items;
    hasMore.value = page.hasMore;
    offset.value = next;
    query.value = term;
  } catch (error) {
    listError.value = applicationError(error, '应用列表读取失败，请刷新重试。');
  } finally {
    loading.value = false;
  }
}

async function loadDetails(id: string) {
  const requestId = ++detailRequest;
  detailsLoading.value = true;
  detailError.value = '';
  try {
    const view = await getApplication(id);
    if (requestId === detailRequest) {
      selected.value = view;
      stale.value = false;
    }
  } catch (error) {
    if (requestId === detailRequest) detailError.value = applicationError(error, '应用详情读取失败。');
  } finally {
    if (requestId === detailRequest) detailsLoading.value = false;
  }
}

function openDetails(id: string) {
  if (busy.value || credential.value) return;
  selected.value = undefined;
  editing.value = false;
  tab.value = 'policy';
  detailsOpen.value = true;
  loadDetails(id);
}

function openRegistration() {
  name.value = '';
  registrationError.value = '';
  registrationOpen.value = true;
}

async function register() {
  if (busy.value || !name.value.trim()) return;
  busy.value = true;
  registrationError.value = '';
  try {
    const issued = await registerApplication(name.value.trim());
    registrationOpen.value = false;
    credential.value = issued;
    search.value = '';
    await loadList(0, '');
  } catch (error) {
    registrationError.value = applicationError(error, '注册结果未确认，请先刷新应用列表。');
  } finally {
    busy.value = false;
  }
}

async function loadOptions(reset: boolean) {
  if (optionsLoading.value) return;
  optionsLoading.value = true;
  const next = reset ? 0 : optionOffset.value + 50;
  try {
    const page = await listGrantOptions(next);
    const merged = new Map((reset ? [] : options.value).map((option) => [optionKey(option), option]));
    page.items.forEach((option) => merged.set(optionKey(option), option));
    selected.value?.activeGrants.forEach((grant) => {
      const hsmKey = optionKey({ ...grant, objectId: null, name: '', family: 'HSM' });
      if (!merged.has(optionKey({ ...grant, name: '', family: '' })) && !merged.has(hsmKey)) {
        const existing = { ...grant, name: grant.serviceId, family: '' };
        merged.set(optionKey(existing), existing);
      }
    });
    options.value = [...merged.values()];
    optionOffset.value = next;
    moreOptions.value = page.hasMore;
    return true;
  } catch (error) {
    detailError.value = applicationError(error, '可授权服务读取失败，请重试。');
    return false;
  } finally {
    optionsLoading.value = false;
  }
}

async function editPolicy() {
  const current = selected.value;
  if (!current || optionsLoading.value) return;
  detailError.value = '';
  if (!(await loadOptions(true)) || selected.value !== current || !detailsOpen.value) return;
  maxRequests.value = current.quota?.maxRequests ?? 100;
  windowSeconds.value = current.quota?.windowSeconds ?? 60;
  grants.value = current.activeGrants.map((grant) => {
    const option = options.value.find(
      (item) =>
        item.serviceId === grant.serviceId &&
        item.operation === grant.operation &&
        item.algorithm === grant.algorithm &&
        (item.objectId === null || item.objectId === grant.objectId)
    );
    return { key: ++nextKey, option: option ? optionKey(option) : '', objectId: grant.objectId };
  });
  if (!grants.value.length) grants.value = [emptyGrant()];
  editing.value = true;
}

async function update(work: (view: ApplicationView) => Promise<void>) {
  if (!selected.value || busy.value || stale.value) return;
  busy.value = true;
  detailError.value = '';
  try {
    await work(selected.value);
    ElMessage.success('操作已保存');
    await loadList(offset.value);
  } catch (error) {
    stale.value = true;
    editing.value = false;
    detailError.value = applicationError(error, '操作结果未确认，请刷新详情。');
  } finally {
    busy.value = false;
  }
}

function save() {
  const rows: Grant[] = [];
  for (const row of grants.value) {
    const option = optionMap.value.get(row.option);
    const objectId = option?.objectId ?? row.objectId.trim();
    if (!option || !/^[A-Za-z0-9_.-]{1,128}$/.test(objectId)) {
      detailError.value = '请选择密码服务并填写有效的逻辑对象。';
      return;
    }
    rows.push({ serviceId: option.serviceId, operation: option.operation, algorithm: option.algorithm, objectId });
  }
  if (new Set(rows.map((grant) => JSON.stringify(grant))).size !== rows.length) {
    detailError.value = '请移除重复的授权条目。';
    return;
  }
  if (!Number.isInteger(maxRequests.value) || !Number.isInteger(windowSeconds.value) || !rows.length) {
    detailError.value = '请输入有效的配额并添加至少一条授权。';
    return;
  }
  update(async ({ application }) => {
    selected.value = await saveApplicationPolicy(application, rows, { maxRequests: maxRequests.value, windowSeconds: windowSeconds.value });
    editing.value = false;
  });
}

async function confirm(message: string) {
  try {
    await ElMessageBox.confirm(message, '确认操作', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' });
    return true;
  } catch {
    return false;
  }
}

async function rotate() {
  if (!(await confirm('轮换后旧 APP Secret 立即失效，请准备更新调用端。'))) return;
  await update(async ({ application }) => {
    credential.value = await rotateCredential(application);
    await loadDetails(application.applicationId);
  });
}

async function revoke(grant: Grant) {
  if (!(await confirm('撤销后，应用将失去这项服务授权。'))) return;
  await update(async ({ application }) => {
    selected.value = await revokeApplicationGrant(application, grant);
  });
}

async function suspend() {
  if (!(await confirm('停用后，该应用的凭据将无法发起新调用。'))) return;
  await update(async ({ application }) => {
    selected.value = await suspendApplication(application);
  });
}

onMounted(() => loadList(0));
onBeforeUnmount(clearCredential);
</script>

<style scoped>
.applications {
  padding: 18px;
}
.page-head,
.toolbar,
.detail-top,
.section-head,
.actions,
.pager {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.page-head,
.section-head,
.detail-top {
  justify-content: space-between;
}
.page-head {
  margin-bottom: 20px;
}
h1,
h2,
p {
  margin: 0;
}
h1 {
  font-size: 24px;
  line-height: 1.4;
}
h2 {
  font-size: 16px;
}
.page-head p,
.hint,
.id {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.toolbar {
  margin-bottom: 12px;
}
.toolbar .el-input {
  width: min(330px, 100%);
}
.id,
code {
  overflow-wrap: anywhere;
}
.pager,
.actions {
  justify-content: flex-end;
  margin-top: 14px;
}
.details {
  min-height: 180px;
}
.details .el-alert {
  margin-bottom: 12px;
}
.quota {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 16px;
  padding-top: 14px;
}
.credential-fields {
  display: grid;
  grid-template-columns: minmax(85px, auto) minmax(0, 1fr);
  gap: 12px;
  margin: 14px 0 18px;
}
.credential-fields dd {
  margin: 0;
}
.form-grid,
.grant {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.grant {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
  align-items: end;
}
.form-grid,
.grant,
.policy-form > .hint {
  margin-bottom: 14px;
}
label {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.registration .hint {
  margin: 10px 0;
}
@media (max-width: 580px) {
  .applications {
    padding: 12px;
  }
  .grant {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
