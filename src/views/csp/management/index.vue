<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import {
  consoleRequest,
  ConsoleRequestError,
  type ConsoleCommands,
  type ConsoleResponses,
  type ServiceResource,
  type ApplicationSummary,
  type ApplicationView,
  type ApplicationPolicy,
  type SharedQuota
} from '@/api/csp/console';
import { useCspConsoleStore } from '@/store/modules/cspConsole';
const session = useCspConsoleStore();
const tab = ref<'services' | 'applications' | 'quotas'>('services');
const busy = ref(false),
  error = ref(''),
  notice = ref(''),
  stale = ref(false);
const offset = ref(0),
  hasMore = ref(false);
const services = ref<ServiceResource[]>([]),
  applications = ref<ApplicationSummary[]>([]),
  quotas = ref<SharedQuota[]>([]);
const service = reactive<ConsoleCommands['service-save']>({
  serviceId: '',
  family: 'SVS',
  poolKey: '',
  adapterKey: '',
  enabled: false,
  expectedVersion: '0'
});
const quota = reactive<ConsoleCommands['quota-save']>({
  dimension: 'TENANT',
  key: '10',
  capability: '*',
  maxRequests: 100,
  windowSeconds: 60,
  expectedVersion: '0'
});
const applicationId = ref(''),
  view = ref<ApplicationView | null>(null);
const policy = reactive<ApplicationPolicy>({ capabilities: [], poolKey: '', maxRequests: 100, windowSeconds: 60, services: [] });
const operations = ['RANDOM', 'HASH', 'SIGN', 'VERIFY', 'TIMESTAMP', 'VERIFY_TIMESTAMP', 'SEAL', 'VERIFY_SEAL'];
const capabilities = [
  'RANDOM',
  'HASH',
  'SM3',
  'HSM_RANDOM',
  'HSM_HASH',
  'SVS_SIGN',
  'SVS_VERIFY',
  'TSA_TIMESTAMP',
  'TSA_VERIFY_TIMESTAMP',
  'SEF_SEAL',
  'SEF_VERIFY_SEAL'
];
const labels: Record<string, string> = {
  UNREGISTERED: '未接入',
  DRAFT: '待独立审核',
  PUBLISHED: '已发布',
  SUSPENDED: '已停用',
  ACTIVE: '有效',
  DISABLED: '已禁用',
  REVOKED: '已撤销'
};
function api<K extends keyof ConsoleResponses>(action: K, body: ConsoleCommands[K]) {
  return consoleRequest(action, session.csrf, body);
}
async function run(work: () => Promise<void>, mutation = false) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await work();
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '操作未完成，请刷新确认状态。';
    if (mutation || (failure instanceof ConsoleRequestError && failure.status === 409)) stale.value = true;
  } finally {
    busy.value = false;
  }
}
async function load() {
  if (tab.value === 'services') {
    const p = await api('service-list', { offset: offset.value });
    services.value = p.items;
    hasMore.value = p.hasMore;
  } else if (tab.value === 'applications') {
    const p = await api('application-list', { offset: offset.value });
    applications.value = p.items;
    hasMore.value = p.hasMore;
  } else {
    const p = await api('quota-list', { offset: offset.value });
    quotas.value = p.items;
    hasMore.value = p.hasMore;
  }
}
async function refresh() {
  await run(async () => {
    await load();
    if (applicationId.value && tab.value === 'applications') applyView(await api('application-view', { applicationId: applicationId.value }));
    stale.value = false;
  });
}
async function changeTab(next: typeof tab.value) {
  if (busy.value) return;
  tab.value = next;
  offset.value = 0;
  hasMore.value = false;
  await refresh();
}
async function page(direction: number) {
  offset.value += direction * 50;
  await refresh();
}
function editService(row?: ServiceResource) {
  Object.assign(
    service,
    row
      ? {
          serviceId: row.serviceId,
          family: row.family,
          poolKey: row.poolKey,
          adapterKey: row.adapterKey,
          enabled: row.enabled,
          expectedVersion: row.version
        }
      : { serviceId: '', family: 'SVS', poolKey: '', adapterKey: '', enabled: false, expectedVersion: '0' }
  );
  stale.value = false;
}
async function saveService() {
  if (service.expectedVersion !== '0') {
    try {
      await ElMessageBox.confirm('保存后将清除健康状态并停用该服务已有的应用授权；需要重新提出授权草稿和独立审核。', '确认服务变更', {
        confirmButtonText: '确认保存',
        cancelButtonText: '取消'
      });
    } catch {
      return;
    }
  }
  await run(async () => {
    const saved = await api('service-save', { ...service });
    editService(saved);
    notice.value = '服务已保存，等待适配器上报健康状态。';
    await load();
  }, true);
}
function applyView(next: ApplicationView) {
  view.value = next;
  Object.assign(
    policy,
    next.policy ? structuredClone(next.policy) : { capabilities: [], poolKey: '', maxRequests: 100, windowSeconds: 60, services: [] }
  );
}
async function selectApplication(row: ApplicationSummary) {
  applicationId.value = row.applicationId;
  view.value = null;
  await run(async () => {
    applyView(await api('application-view', { applicationId: row.applicationId }));
    stale.value = false;
  });
}
async function applicationAction(action: 'application-draft' | 'application-publish' | 'application-suspend') {
  if (!view.value) return;
  const prompts = {
    'application-draft': '保存草稿会立即暂停该应用在 CSP 的使用权限，等待另一位有权限的管理员审核发布。',
    'application-publish': '将按当前草稿发布授权和应用配额。提交者必须与审核者不同，且双方当前权限均有效。',
    'application-suspend': '停用后，该应用的 CSP 授权立即失效。此版本尚未提供恢复入口。'
  };
  try {
    await ElMessageBox.confirm(prompts[action], '确认应用授权操作', { confirmButtonText: '确认提交', cancelButtonText: '取消' });
  } catch {
    return;
  }
  const target = { applicationId: applicationId.value, expectedVersion: view.value.version };
  await run(async () => {
    const result =
      action === 'application-draft'
        ? await api(action, {
            ...target,
            capabilities: [...policy.capabilities],
            poolKey: policy.capabilities.length ? policy.poolKey : '',
            maxRequests: policy.maxRequests,
            windowSeconds: policy.windowSeconds,
            services: policy.services.map((g) => ({ ...g }))
          })
        : await api(action, target);
    applyView(result);
    notice.value = '已完成，当前状态：' + (labels[result.state] || result.state);
    await load();
  }, true);
}
function editQuota(row?: SharedQuota) {
  Object.assign(
    quota,
    row
      ? {
          dimension: row.dimension,
          key: row.key,
          capability: row.capability,
          maxRequests: row.maxRequests,
          windowSeconds: row.windowSeconds,
          expectedVersion: row.version
        }
      : { dimension: 'TENANT', key: '10', capability: '*', maxRequests: 100, windowSeconds: 60, expectedVersion: '0' }
  );
  stale.value = false;
}
async function saveQuota() {
  await run(async () => {
    const saved = await api('quota-save', { ...quota });
    editQuota(saved);
    notice.value = '共享配额已保存。';
    await load();
  }, true);
}
onMounted(refresh);
</script>
<template>
  <section class="management-page" aria-labelledby="management-title">
    <header class="management-heading">
      <div>
        <h1 id="management-title">服务与应用管理</h1>
        <p>登记密码服务，按逻辑对象授权应用，设置共享配额。</p>
      </div>
      <el-button :disabled="busy" @click="refresh">刷新当前页</el-button>
    </header>
    <nav class="management-tabs" aria-label="管理分类">
      <el-button :type="tab === 'services' ? 'primary' : 'default'" :aria-pressed="tab === 'services'" :disabled="busy" @click="changeTab('services')"
        >密码服务</el-button
      >
      <el-button
        :type="tab === 'applications' ? 'primary' : 'default'"
        :aria-pressed="tab === 'applications'"
        :disabled="busy"
        @click="changeTab('applications')"
        >应用授权</el-button
      >
      <el-button :type="tab === 'quotas' ? 'primary' : 'default'" :aria-pressed="tab === 'quotas'" :disabled="busy" @click="changeTab('quotas')"
        >共享配额</el-button
      >
    </nav>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="stale" role="status">请刷新并重新选择记录，核对版本后再提交。</p>
    <div v-if="tab === 'services'" :aria-busy="busy">
      <div class="table-scroll" tabindex="0" aria-label="密码服务列表">
        <table>
          <thead>
            <tr>
              <th>服务标识 / 类型</th>
              <th>资源池 / 适配器</th>
              <th>运行状态</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in services" :key="row.serviceId">
              <td>
                {{ row.serviceId }}<small>{{ row.family }} · {{ row.simulated ? '模拟服务' : '真实服务' }}</small>
              </td>
              <td>
                {{ row.poolKey }}<small>{{ row.adapterKey }}</small>
              </td>
              <td>{{ row.enabled ? '已启用' : '已禁用' }} · {{ row.healthy ? '健康' : '待健康检查' }}</td>
              <td>{{ row.version }}</td>
              <td><el-button :disabled="busy" :aria-label="'编辑服务 ' + row.serviceId" @click="editService(row)">编辑</el-button></td>
            </tr>
            <tr v-if="!services.length">
              <td colspan="5">当前页暂无服务；可登记已部署的适配器。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <form class="management-card" @submit.prevent="saveService">
        <h2>{{ service.expectedVersion === '0' ? '登记服务' : '编辑服务' }}</h2>
        <fieldset :disabled="busy || stale">
          <div class="form-grid">
            <label
              >服务标识<input
                v-model="service.serviceId"
                required
                pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,127}"
                :readonly="service.expectedVersion !== '0'"
            /></label>
            <label
              >服务类型<select v-model="service.family">
                <option v-for="f in ['HSM', 'SVS', 'TSA', 'SEF']" :key="f">{{ f }}</option>
              </select></label
            >
            <label>资源池标识<input v-model="service.poolKey" required maxlength="128" /></label
            ><label>已部署适配器标识<input v-model="service.adapterKey" required maxlength="128" /></label>
          </div>
          <label class="check"><input v-model="service.enabled" type="checkbox" />启用服务</label>
          <p>模拟或真实属性由适配器决定；健康状态由执行端上报。修改服务会停用其已有授权。</p>
          <el-button native-type="submit" type="primary" :disabled="busy || stale">保存服务</el-button
          ><el-button :disabled="busy" @click="editService()">新建服务</el-button>
        </fieldset>
      </form>
    </div>
    <div v-if="tab === 'applications'" :aria-busy="busy">
      <p>应用须先在平台登记。本页管理 CSP 授权；提出草稿和审核发布由不同管理员完成。</p>
      <div class="table-scroll" tabindex="0" aria-label="应用列表">
        <table>
          <thead>
            <tr>
              <th>应用名称 / 标识</th>
              <th>平台注册状态</th>
              <th>CSP 授权状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in applications" :key="row.applicationId">
              <td>
                {{ row.name }}<small>{{ row.applicationId }}</small>
              </td>
              <td>{{ labels[row.platformStatus] || row.platformStatus }}</td>
              <td>{{ labels[row.onboardingState] || row.onboardingState }}</td>
              <td><el-button :disabled="busy" :aria-label="'管理应用 ' + row.name" @click="selectApplication(row)">管理授权</el-button></td>
            </tr>
            <tr v-if="!applications.length">
              <td colspan="4">当前页没有已登记应用。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <form v-if="view" class="management-card" @submit.prevent="applicationAction('application-draft')">
        <h2>应用授权配置</h2>
        <p class="break">{{ applicationId }} · 版本 {{ view.version }} · {{ labels[view.state] || view.state }}</p>
        <p>提出者：{{ view.proposerId || '—' }}　审核者：{{ view.approverId || '—' }}</p>
        <fieldset :disabled="busy || stale || view.state === 'SUSPENDED'">
          <div class="form-grid">
            <label>应用窗口请求上限<input v-model.number="policy.maxRequests" type="number" min="1" max="1000000" required /></label
            ><label>窗口秒数<input v-model.number="policy.windowSeconds" type="number" min="1" max="3600" required /></label>
          </div>
          <h3>服务与逻辑对象授权</h3>
          <p>对象标识须与服务端配置一致。模拟服务使用 MOCK 算法。</p>
          <div v-for="(g, index) in policy.services" :key="index" class="grant-row">
            <label>服务标识 {{ index + 1 }}<input v-model="g.serviceId" required maxlength="128" /></label
            ><label
              >操作 {{ index + 1
              }}<select v-model="g.operation">
                <option v-for="op in operations" :key="op">{{ op }}</option>
              </select></label
            ><label>算法 {{ index + 1 }}<input v-model="g.algorithm" required maxlength="32" /></label
            ><label>逻辑对象 {{ index + 1 }}<input v-model="g.objectId" required maxlength="128" /></label
            ><el-button :disabled="busy || stale" :aria-label="'删除授权 ' + (index + 1)" @click="policy.services.splice(index, 1)">删除</el-button>
          </div>
          <el-button
            :disabled="busy || stale || policy.services.length >= 128"
            @click="policy.services.push({ serviceId: '', operation: 'SIGN', algorithm: 'MOCK', objectId: '' })"
            >添加服务授权</el-button
          >
          <details>
            <summary>兼容已有随机数 / 摘要能力授权</summary>
            <label v-for="cap in ['RANDOM', 'HASH', 'SM3']" :key="cap" class="check"
              ><input v-model="policy.capabilities" :value="cap" type="checkbox" />{{ cap }}</label
            ><label v-if="policy.capabilities.length">已有设备池标识<input v-model="policy.poolKey" required maxlength="128" /></label>
          </details>
          <div class="actions">
            <el-button native-type="submit" type="primary" :disabled="busy || stale || view.state === 'SUSPENDED'">保存授权草稿</el-button
            ><el-button :disabled="busy || stale || view.state !== 'DRAFT'" @click="applicationAction('application-publish')">审核发布</el-button
            ><el-button
              type="danger"
              plain
              :disabled="busy || stale || ['SUSPENDED', 'UNREGISTERED'].includes(view.state)"
              @click="applicationAction('application-suspend')"
              >停用应用授权</el-button
            >
          </div>
        </fieldset>
      </form>
    </div>
    <div v-if="tab === 'quotas'" :aria-busy="busy">
      <p>发布前必须具备产品、能力和资源池配额；应用配额随授权草稿一并审核。</p>
      <div class="table-scroll" tabindex="0" aria-label="共享配额列表">
        <table>
          <thead>
            <tr>
              <th>维度 / 标识</th>
              <th>能力</th>
              <th>窗口上限</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in quotas" :key="row.dimension + row.key + row.capability">
              <td>
                {{ row.dimension }}<small>{{ row.key }}</small>
              </td>
              <td>{{ row.capability }}</td>
              <td>{{ row.maxRequests }} 次 / {{ row.windowSeconds }} 秒</td>
              <td>{{ row.version }}</td>
              <td>
                <el-button :disabled="busy" :aria-label="'编辑配额 ' + row.dimension + ' ' + row.key + ' ' + row.capability" @click="editQuota(row)"
                  >编辑</el-button
                >
              </td>
            </tr>
            <tr v-if="!quotas.length">
              <td colspan="5">当前页暂无共享配额。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <form class="management-card" @submit.prevent="saveQuota">
        <h2>设置共享配额</h2>
        <fieldset :disabled="busy || stale">
          <div class="form-grid">
            <label
              >配额维度<select
                v-model="quota.dimension"
                :disabled="quota.expectedVersion !== '0'"
                @change="quota.key = quota.dimension === 'TENANT' ? '10' : ''"
              >
                <option value="TENANT">CSP 产品</option>
                <option value="CAPABILITY">能力</option>
                <option value="RESOURCE_POOL">资源池</option>
              </select></label
            ><label
              >维度标识<input
                v-model="quota.key"
                required
                :readonly="quota.dimension === 'TENANT' || quota.expectedVersion !== '0'"
                maxlength="128" /></label
            ><label
              >能力范围<select v-model="quota.capability" :disabled="quota.expectedVersion !== '0'">
                <option value="*">全部能力（*）</option>
                <option v-for="cap in capabilities" :key="cap">{{ cap }}</option>
              </select></label
            ><label>窗口请求上限<input v-model.number="quota.maxRequests" type="number" min="1" max="1000000" required /></label
            ><label>窗口秒数<input v-model.number="quota.windowSeconds" type="number" min="1" max="3600" required /></label>
          </div>
          <div class="actions">
            <el-button native-type="submit" type="primary" :disabled="busy || stale">保存配额</el-button
            ><el-button :disabled="busy" @click="editQuota()">新建配额</el-button>
          </div>
        </fieldset>
      </form>
    </div>
    <footer class="pagination">
      <el-button :disabled="busy || offset === 0" @click="page(-1)">上一页</el-button><span>第 {{ offset / 50 + 1 }} 页 · 每页最多 50 条</span
      ><el-button :disabled="busy || !hasMore" @click="page(1)">下一页</el-button>
    </footer>
  </section>
</template>
<style scoped>
.management-page {
  padding: 24px;
  max-width: 1500px;
  margin: 0 auto;
  color: #243447;
}
.management-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.management-heading h1 {
  font-size: 24px;
  margin: 0;
}
.management-heading p,
.management-card p {
  color: #526579;
  line-height: 1.6;
}
.management-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 24px 0;
}
.table-scroll {
  overflow-x: auto;
  background: white;
  border: 1px solid #dce3ed;
  border-radius: 8px;
}
table {
  border-collapse: collapse;
  min-width: 650px;
  width: 100%;
  text-align: left;
}
th,
td {
  padding: 14px 18px;
  border-bottom: 1px solid #e5eaf0;
}
th {
  background: #f3f6fa;
  font-weight: 600;
}
small {
  display: block;
  margin-top: 6px;
  color: #526579;
  overflow-wrap: anywhere;
}
.management-card {
  margin-top: 24px;
  background: white;
  border: 1px solid #dce3ed;
  border-radius: 8px;
  padding: 24px;
}
h2 {
  font-size: 18px;
  margin-top: 0;
}
h3 {
  font-size: 16px;
}
fieldset {
  padding: 0;
  border: 0;
  min-width: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}
input,
select {
  width: 100%;
  min-height: 40px;
  border: 1px solid #9cacbe;
  border-radius: 4px;
  padding: 8px;
  background: white;
  color: #243447;
  box-sizing: border-box;
}
input:focus,
select:focus {
  outline: 2px solid #176ac3;
  outline-offset: 2px;
}
input[readonly] {
  background: #f3f6fa;
}
.check {
  flex-direction: row;
  align-items: center;
  margin: 16px 0;
}
.check input {
  width: 18px;
  min-height: 18px;
}
.grant-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 12px;
  border-bottom: 1px solid #e5eaf0;
  padding: 16px 0;
  margin-bottom: 12px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
.actions .el-button {
  margin: 0;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  font-size: 14px;
}
.break {
  overflow-wrap: anywhere;
}
.success {
  padding: 12px;
  background: #eef8f1;
  color: #235b35;
  border-radius: 6px;
}
details {
  margin: 24px 0;
}
summary {
  cursor: pointer;
  line-height: 2;
}
.error {
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .management-page {
    padding: 16px;
  }
  .management-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .form-grid,
  .grant-row {
    grid-template-columns: 1fr;
  }
  .management-card {
    padding: 16px;
  }
  .management-tabs .el-button {
    margin: 0;
  }
  .pagination span {
    width: 100%;
    text-align: center;
  }
}
</style>
