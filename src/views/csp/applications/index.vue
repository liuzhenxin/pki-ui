<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElDialog, ElMessageBox } from 'element-plus';
import {
  ConsoleRequestError,
  consoleRequest,
  type ConsoleCommands,
  type ConsoleResponses,
  type IssuedApplicationCredential,
  type OwnedApplication,
  type OwnedApplicationPolicy,
  type OwnedApplicationView,
  type ServiceFamily,
  type ServiceGrant,
  type ServiceResource
} from '@/api/csp/console';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

const session = useCspConsoleStore();
const items = ref<OwnedApplication[]>([]);
const selected = ref<OwnedApplicationView>();
const resources = ref<ServiceResource[]>([]);
const resourceOffset = ref(0);
const moreResources = ref(false);
const offset = ref(0);
const more = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const name = ref('');
const editingName = ref(false);
const updatedName = ref('');
const credential = ref<IssuedApplicationCredential>();
const credentialsVisible = ref(false);
const stale = ref(false);
const policy = reactive<OwnedApplicationPolicy>({ grants: [], maxRequests: 100, windowSeconds: 60 });
const grant = reactive<ServiceGrant>({ serviceId: '', operation: '', algorithm: '', objectId: '' });
const operationOptions: Record<ServiceFamily, string[]> = {
  HSM: ['RANDOM', 'HASH'],
  SVS: ['SIGN', 'VERIFY'],
  TSA: ['TIMESTAMP', 'VERIFY_TIMESTAMP'],
  SEF: ['SEAL', 'VERIFY_SEAL']
};
const operations = computed(() => {
  const resource = resources.value.find((item) => item.serviceId === grant.serviceId);
  return resource ? operationOptions[resource.family] : [];
});

function api<K extends keyof ConsoleResponses>(action: K, command: ConsoleCommands[K]) {
  return consoleRequest(action, session.csrf, command);
}

async function run(work: () => Promise<void>, writes = false) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await work();
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '操作失败，请刷新核对。';
    if (writes) stale.value = true;
  } finally {
    busy.value = false;
  }
}

async function list() {
  const page = await api('owned-application-list', { offset: offset.value });
  items.value = page.items;
  more.value = page.hasMore;
}

async function loadResources(next: number) {
  const page = await api('owned-service-list', { offset: next });
  resources.value = next === 0 ? page.items : [...resources.value, ...page.items];
  resourceOffset.value = next;
  moreResources.value = page.hasMore;
}

function useView(view: OwnedApplicationView) {
  selected.value = view;
  editingName.value = false;
  policy.grants = view.activeGrants.map((item) => ({ ...item }));
  policy.maxRequests = view.quota?.maxRequests ?? 100;
  policy.windowSeconds = view.quota?.windowSeconds ?? 60;
}

async function open(item: OwnedApplication) {
  await run(async () => {
    useView(await api('owned-application-view', { applicationId: item.applicationId }));
    if (session.canOperateApplications && resources.value.length === 0) await loadResources(0);
    stale.value = false;
  });
}

async function refresh() {
  await run(async () => {
    await list();
    if (selected.value) {
      try {
        useView(await api('owned-application-view', { applicationId: selected.value.application.applicationId }));
      } catch (failure) {
        if (!(failure instanceof ConsoleRequestError) || failure.status !== 409) throw failure;
        selected.value = undefined;
        editingName.value = false;
      }
    }
    if (session.canOperateApplications && selected.value) await loadResources(0);
    stale.value = false;
  });
}

async function nextPage(direction: number) {
  await run(async () => {
    offset.value += direction * 50;
    await list();
  });
}

function clearCredential() {
  credential.value = undefined;
}

function showCredential(issued: IssuedApplicationCredential) {
  credential.value = issued;
  credentialsVisible.value = true;
}

async function register() {
  await run(async () => {
    showCredential(await api('owned-application-register', { name: name.value.trim() }));
    name.value = '';
    await list();
  }, true);
}

function editName() {
  updatedName.value = selected.value?.application.name ?? '';
  editingName.value = true;
}

async function rename() {
  const target = selected.value?.application;
  const normalized = updatedName.value.trim();
  if (!target || stale.value || !normalized || normalized === target.name) return;
  await run(async () => {
    selected.value = await api('owned-application-rename', {
      applicationId: target.applicationId,
      expectedVersion: target.version,
      name: normalized
    });
    editingName.value = false;
    notice.value = '应用名称已保存。';
    await list();
  }, true);
}

function addGrant() {
  if (
    !grant.serviceId ||
    !operations.value.includes(grant.operation) ||
    !/^[A-Za-z0-9_-]{1,32}$/.test(grant.algorithm) ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(grant.objectId) ||
    policy.grants.length >= 128
  )
    return;
  const duplicate = policy.grants.some(
    (item) =>
      item.serviceId === grant.serviceId &&
      item.operation === grant.operation &&
      item.algorithm === grant.algorithm &&
      item.objectId === grant.objectId
  );
  if (!duplicate) policy.grants.push({ ...grant });
  else error.value = '授权列表中已有这一项。';
}

async function change(action: 'savePolicy' | 'rotate' | 'suspend' | 'revoke' | 'remove', item?: ServiceGrant) {
  const target = selected.value?.application;
  if (!target || busy.value || stale.value) return;
  const prompts = {
    savePolicy: '保存后，新的服务授权和应用配额立即生效。',
    rotate: '签发新 APP Secret 后，旧 APP Secret 将失效。',
    suspend: '停用后，应用凭据和当前授权立即失效。',
    revoke: '撤销选中的授权，后续请求将无法使用该授权。',
    remove: '移除已停用的应用及其配额。此操作无法撤销，审计记录会保留。'
  };
  try {
    await ElMessageBox.confirm(prompts[action], '确认应用操作', { confirmButtonText: '确认', cancelButtonText: '取消' });
  } catch {
    return;
  }
  const command = { applicationId: target.applicationId, expectedVersion: target.version };
  await run(async () => {
    if (action === 'rotate') {
      showCredential(await api('owned-application-rotate', command));
      useView(await api('owned-application-view', { applicationId: target.applicationId }));
    } else if (action === 'savePolicy') {
      useView(await api('owned-application-save-policy', { ...command, policy: { ...policy, grants: policy.grants.map((row) => ({ ...row })) } }));
    } else if (action === 'revoke' && item) {
      useView(await api('owned-application-revoke', { ...command, grant: item }));
    } else if (action === 'suspend') {
      useView(await api('owned-application-suspend', command));
    } else if (action === 'remove') {
      await api('owned-application-remove', command);
      selected.value = undefined;
      editingName.value = false;
    }
    notice.value = action === 'remove' ? '应用已移除。' : '操作已保存。';
    await list();
    if (action === 'remove' && offset.value > 0 && items.value.length === 0) {
      offset.value = 0;
      await list();
    }
  }, true);
}

onMounted(refresh);
onBeforeUnmount(clearCredential);
</script>

<template>
  <section class="applications-page">
    <header>
      <h1>应用列表</h1>
      <el-button :disabled="busy" @click="refresh">刷新</el-button>
    </header>
    <form v-if="session.canOperateApplications" class="application-form" @submit.prevent="register">
      <label>应用名称<input v-model="name" maxlength="120" required placeholder="例如 OA 系统" /></label>
      <el-button type="primary" native-type="submit" :disabled="busy || stale || !name.trim() || !session.secure">注册并签发凭据</el-button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div class="table-scroll">
      <table aria-label="已登记应用">
        <thead>
          <tr>
            <th>应用</th>
            <th>APP Key</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.applicationId">
            <td>{{ item.name }}</td>
            <td>
              <code>{{ item.appKey }}</code>
            </td>
            <td>{{ item.enabled ? '已登记' : '已停用' }}</td>
            <td><el-button :disabled="busy" text @click="open(item)">查看授权</el-button></td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="4">暂无应用</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="offset || more" class="actions">
      <el-button :disabled="busy || offset === 0" @click="nextPage(-1)">上一页</el-button>
      <el-button :disabled="busy || !more" @click="nextPage(1)">下一页</el-button>
    </div>
    <section v-if="selected" class="application-details">
      <header>
        <h2>{{ selected.application.name }}</h2>
        <div v-if="session.canOperateApplications && selected.application.enabled" class="actions">
          <el-button :disabled="busy || stale || editingName" @click="editName">修改名称</el-button>
          <el-button :disabled="busy || stale || !session.secure" @click="change('rotate')">轮换 APP Secret</el-button>
          <el-button type="danger" plain :disabled="busy || stale" @click="change('suspend')">停用应用</el-button>
        </div>
        <el-button v-else-if="session.canOperateApplications" type="danger" plain :disabled="busy || stale" @click="change('remove')"
          >移除应用</el-button
        >
      </header>
      <form v-if="editingName" class="application-form" @submit.prevent="rename">
        <label>新应用名称<input v-model="updatedName" maxlength="120" required :disabled="busy || stale" /></label>
        <el-button
          type="primary"
          native-type="submit"
          :disabled="busy || stale || !updatedName.trim() || updatedName.trim() === selected.application.name"
          >保存名称</el-button
        >
        <el-button :disabled="busy" @click="editingName = false">取消</el-button>
      </form>
      <h3>生效授权</h3>
      <ul v-if="selected.activeGrants.length">
        <li v-for="(item, index) in selected.activeGrants" :key="index">
          {{ item.serviceId }} · {{ item.operation }} · {{ item.algorithm }} · {{ item.objectId }}
          <el-button v-if="session.canOperateApplications" :disabled="busy || stale" text @click="change('revoke', item)">撤销授权</el-button>
        </li>
      </ul>
      <p v-else>暂无生效授权</p>
      <template v-if="selected.application.enabled && session.canOperateApplications">
        <h3>配置授权和配额</h3>
        <ul>
          <li v-for="(item, index) in policy.grants" :key="index">
            {{ item.serviceId }} · {{ item.operation }} · {{ item.algorithm }} · {{ item.objectId }}
            <el-button :disabled="busy || stale" text @click="policy.grants.splice(index, 1)">移除</el-button>
          </li>
        </ul>
        <form class="application-form" @submit.prevent="addGrant">
          <label
            ><span id="application-grant-service-label">服务</span>
            <select v-model="grant.serviceId" aria-labelledby="application-grant-service-label" required @change="grant.operation = ''">
              <option value="">请选择服务</option>
              <option v-for="resource in resources.filter((item) => item.enabled)" :key="resource.serviceId" :value="resource.serviceId">
                {{ resource.serviceId }}（{{ resource.family }}）
              </option>
            </select></label
          >
          <el-button v-if="moreResources" :disabled="busy" @click="run(() => loadResources(resourceOffset + 50))">加载更多服务</el-button>
          <label
            ><span id="application-grant-operation-label">操作</span>
            <select v-model="grant.operation" aria-labelledby="application-grant-operation-label" required>
              <option value="">请选择操作</option>
              <option v-for="operation in operations" :key="operation">{{ operation }}</option>
            </select></label
          >
          <label>算法<input v-model.trim="grant.algorithm" maxlength="32" required /></label>
          <label>逻辑对象<input v-model.trim="grant.objectId" maxlength="128" required /></label>
          <el-button native-type="submit" :disabled="busy || stale">添加授权</el-button>
        </form>
        <div class="application-form">
          <label>请求上限<input v-model.number="policy.maxRequests" type="number" min="1" max="1000000" /></label>
          <label>窗口秒数<input v-model.number="policy.windowSeconds" type="number" min="1" max="3600" /></label>
          <el-button type="primary" :disabled="busy || stale || !policy.grants.length" @click="change('savePolicy')">保存并生效</el-button>
        </div>
      </template>
    </section>
    <el-dialog v-model="credentialsVisible" title="应用凭据" width="min(520px, 92vw)" :close-on-click-modal="false" @close="clearCredential">
      <template v-if="credential">
        <p>请现在复制凭据。关闭后需轮换才能取得新的 APP Secret。</p>
        <label class="credential-field">APP Key<input readonly :value="credential.appKey" /></label>
        <label class="credential-field">APP Secret<input readonly autocomplete="off" :value="credential.appSecret" /></label>
        <el-button type="primary" @click="credentialsVisible = false">已保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.applications-page {
  padding: 24px;
}
header,
.actions,
.application-form {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
}
header {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.application-form {
  margin: 12px 0;
}
label {
  display: grid;
  gap: 5px;
}
input,
select {
  padding: 7px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  min-width: 0;
}
.table-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
td,
th {
  text-align: left;
  border-bottom: 1px solid var(--el-border-color);
  padding: 8px;
}
.application-details,
.actions {
  margin-top: 16px;
}
.credential-field {
  margin: 12px 0;
}
.error {
  color: var(--el-color-danger);
}
</style>
