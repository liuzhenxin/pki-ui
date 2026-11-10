<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import mark from '@/assets/brand/csp-mark-inverse.svg';
import {
  authorizationTarget,
  connectionError,
  newApplication,
  newResource,
  previewId,
  resourceDeletionReason,
  resourceLabels,
  sampleData,
  type Application,
  type PreviewData,
  type Resource,
  type ResourceKind,
  type Section
} from './model';

const storageKey = 'csp-admin-preview-v2';
const serviceKinds = ['svs', 'tsa', 'sef'] as const;
const sections = ['overview', 'applications', 'device', ...serviceKinds] as const;
const titles: Record<Section, string> = {
  overview: '运行总览',
  applications: '应用列表',
  device: '设备列表',
  svs: resourceLabels.svs,
  tsa: resourceLabels.tsa,
  sef: resourceLabels.sef
};
const healthLabels = { unchecked: '待验证', healthy: '健康', failed: '异常' } as const;
const approvalLabels = { draft: '草稿', pending: '待审核', published: '已发布', disabled: '已停用' } as const;

function loadData(): PreviewData {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const data: PreviewData = JSON.parse(saved);
      if (Array.isArray(data.applications) && Array.isArray(data.resources)) return data;
    }
  } catch {
    // A restricted browser can still run the preview with in-memory data.
  }
  return sampleData();
}

const data = ref(loadData());
watch(
  data,
  (value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      ElMessage.warning('浏览器未保存演示数据，本次操作仍可继续。');
    }
  },
  { deep: true }
);

const section = ref<Section>('overview');
const query = ref('');
const issueOnly = ref(false);
const reviewOnly = ref(false);
const sidebarOpen = ref(false);
const resourceEditor = ref<Resource>();
const applicationEditor = ref<Application>();
const formError = ref('');
const resources = computed(() =>
  data.value.resources.filter(
    (item) =>
      item.kind === section.value &&
      matches(item.name, item.endpoint, item.provider) &&
      (!issueOnly.value || (item.enabled && item.health !== 'healthy'))
  )
);
const applications = computed(() =>
  data.value.applications.filter((item) => matches(item.name, item.clientId, item.owner) && (!reviewOnly.value || item.approval === 'pending'))
);
const issues = computed(() => data.value.resources.filter((item) => item.enabled && item.health !== 'healthy'));
const pendingCount = computed(() => data.value.applications.filter((item) => item.approval === 'pending').length);
const deviceCount = computed(() => data.value.resources.filter((item) => item.kind === 'device').length);
const targets = computed(() =>
  Array.from(
    new Map(
      data.value.resources.map((item) => [
        authorizationTarget(item),
        item.kind === 'device' ? `${item.pool} · 密码机资源池` : `${item.name} · ${resourceLabels[item.kind]}`
      ])
    )
  )
);
const resourceKind = computed<ResourceKind | undefined>(() =>
  section.value === 'overview' || section.value === 'applications' ? undefined : section.value
);

function matches(...values: string[]) {
  const filter = query.value.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(filter));
}

function select(next: Section, filter?: 'issue' | 'review') {
  section.value = next;
  query.value = '';
  issueOnly.value = filter === 'issue';
  reviewOnly.value = filter === 'review';
  sidebarOpen.value = false;
  const hash = next === 'overview' ? '' : '#' + next;
  if (location.hash !== hash) history.pushState(null, '', location.pathname + location.search + hash);
}

function syncLocation() {
  const target = sections.find((candidate) => candidate === location.hash.slice(1)) ?? 'overview';
  select(target);
}

onMounted(() => {
  syncLocation();
  window.addEventListener('popstate', syncLocation);
});
onUnmounted(() => window.removeEventListener('popstate', syncLocation));

function editResource(kind: ResourceKind, item?: Resource) {
  formError.value = '';
  resourceEditor.value = item ? { ...item } : newResource(kind);
}

function editApplication(item?: Application) {
  formError.value = '';
  applicationEditor.value = item ? { ...item, targets: [...item.targets] } : newApplication();
}

async function confirmAction(message: string) {
  try {
    await ElMessageBox.confirm(message, '确认操作', { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' });
    return true;
  } catch {
    return false;
  }
}

async function saveResource() {
  const draft = resourceEditor.value;
  if (!draft) return;
  draft.name = draft.name.trim();
  draft.endpoint = draft.endpoint.trim();
  draft.provider = draft.provider.trim();
  draft.agent = draft.agent.trim();
  draft.pool = draft.pool.trim();
  draft.credentialRef = draft.credentialRef.trim();
  if (!draft.name || !draft.provider || (draft.kind === 'device' && (!draft.agent || !draft.pool))) {
    formError.value = '请填写名称、厂商或协议，以及密码机的接入节点和资源池。';
    return;
  }
  if (!Number.isInteger(draft.timeoutMs) || draft.timeoutMs < 100 || draft.timeoutMs > 60000) {
    formError.value = '请求超时必须在 100 至 60000 毫秒之间。';
    return;
  }
  const invalidConnection = connectionError(draft);
  if (invalidConnection) {
    formError.value = invalidConnection;
    return;
  }
  if (data.value.resources.some((item) => item.kind === draft.kind && item.id !== draft.id && item.name === draft.name)) {
    formError.value = '同类资源名称已存在。';
    return;
  }
  const previous = data.value.resources.find((item) => item.id === draft.id);
  if (previous) {
    const oldTarget = authorizationTarget(previous);
    const isOnlyMember = !data.value.resources.some((item) => item.id !== previous.id && authorizationTarget(item) === oldTarget);
    if (
      draft.pool !== previous.pool &&
      (previous.keyBindings > 0 || (isOnlyMember && data.value.applications.some((app) => app.targets.includes(oldTarget))))
    ) {
      formError.value = '请先处理现有密钥绑定或资源池的应用引用，再调整所属资源池。';
      return;
    }
    const configurationChanged = (['endpoint', 'provider', 'agent', 'pool', 'credentialRef', 'timeoutMs'] as const).some(
      (field) => previous[field] !== draft[field]
    );
    if (configurationChanged) {
      const affected = isOnlyMember ? data.value.applications.filter((app) => app.targets.includes(oldTarget) && app.approval !== 'disabled') : [];
      if (affected.length && !(await confirmAction(`此次修改将暂停 ${affected.map((app) => app.name).join('、')} 的演示授权并退回草稿。`))) return;
      affected.forEach((app) => (app.approval = 'draft'));
      draft.health = 'unchecked';
      draft.enabled = false;
    }
    Object.assign(previous, draft);
  } else {
    data.value.resources.push({ ...draft, id: previewId() });
  }
  resourceEditor.value = undefined;
  ElMessage.success('演示资源已保存');
}

function saveApplication() {
  const draft = applicationEditor.value;
  if (!draft) return;
  draft.name = draft.name.trim();
  draft.clientId = draft.clientId.trim();
  draft.owner = draft.owner.trim();
  if (!draft.name || !draft.clientId || !draft.owner) {
    formError.value = '请填写应用名称、客户端标识和负责人。';
    return;
  }
  if (
    !Number.isInteger(draft.maxRequests) ||
    draft.maxRequests < 1 ||
    draft.maxRequests > 1000000 ||
    !Number.isInteger(draft.windowSeconds) ||
    draft.windowSeconds < 1 ||
    draft.windowSeconds > 3600
  ) {
    formError.value = '请输入有效的调用上限和窗口秒数。';
    return;
  }
  if (data.value.applications.some((item) => item.id !== draft.id && item.clientId === draft.clientId)) {
    formError.value = '客户端标识已被其他演示应用使用。';
    return;
  }
  const previous = data.value.applications.find((item) => item.id === draft.id);
  if (previous) {
    const authorizationChanged =
      previous.clientId !== draft.clientId ||
      previous.maxRequests !== draft.maxRequests ||
      previous.windowSeconds !== draft.windowSeconds ||
      previous.targets.length !== draft.targets.length ||
      draft.targets.some((target) => !previous.targets.includes(target));
    Object.assign(previous, draft);
    if (authorizationChanged) previous.approval = 'draft';
  } else {
    data.value.applications.push({ ...draft, id: previewId() });
  }
  applicationEditor.value = undefined;
  ElMessage.success('演示应用已保存');
}

function simulateConnection(item: Resource) {
  const error = connectionError(item);
  if (error) {
    item.health = 'failed';
    ElMessage.error(error);
    return;
  }
  item.health = 'healthy';
  ElMessage.success('模拟连接检查通过');
}

async function toggleResource(item: Resource) {
  if (!item.enabled && item.health !== 'healthy') {
    ElMessage.warning('请先通过模拟连接检查。');
    return;
  }
  if (item.enabled && !(await confirmAction(`停用「${item.name}」后，该资源将退出演示调用路径。`))) return;
  item.enabled = !item.enabled;
}

async function removeResource(item: Resource) {
  const reason = resourceDeletionReason(item, data.value);
  if (reason) {
    ElMessage.warning(reason);
    return;
  }
  if (await confirmAction(`删除演示资源「${item.name}」？`)) {
    data.value.resources = data.value.resources.filter((resource) => resource.id !== item.id);
  }
}

function submitApplication(item: Application) {
  const available = (target: string) =>
    data.value.resources.some((resource) => authorizationTarget(resource) === target && resource.enabled && resource.health === 'healthy');
  if (!item.targets.length || !item.targets.every(available)) {
    ElMessage.warning('请选择已启用且健康的演示资源。');
    return;
  }
  item.approval = 'pending';
  ElMessage.success('已提交模拟审核');
}

async function disableApplication(item: Application) {
  if (await confirmAction(`停用「${item.name}」在 CSP 的演示授权？`)) item.approval = 'disabled';
}

async function removeApplication(item: Application) {
  if (item.approval === 'pending' || item.approval === 'published') {
    ElMessage.warning('请先停用应用授权。');
    return;
  }
  if (await confirmAction(`移除「${item.name}」的 CSP 演示接入记录？`)) {
    data.value.applications = data.value.applications.filter((app) => app.id !== item.id);
  }
}
</script>

<template>
  <div class="preview-shell">
    <button v-if="sidebarOpen" class="preview-backdrop" aria-label="关闭菜单" @click="sidebarOpen = false" />
    <aside id="preview-nav" class="preview-sidebar" :class="{ open: sidebarOpen }">
      <button class="preview-brand" @click="select('overview')">
        <img :src="mark" alt="" width="32" height="32" />
        <span>密码服务平台</span>
      </button>
      <nav aria-label="系统管理员菜单">
        <el-menu :default-active="section" :default-openeds="['access', 'hardware', 'services']" @select="select($event as Section)">
          <el-menu-item index="overview">运行总览</el-menu-item>
          <el-sub-menu index="access">
            <template #title>应用接入</template>
            <el-menu-item index="applications">应用列表</el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="hardware">
            <template #title>密码设备管理</template>
            <el-menu-item index="device">设备列表</el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="services">
            <template #title>密码服务管理</template>
            <el-menu-item v-for="kind in serviceKinds" :key="kind" :index="kind">{{ titles[kind] }}</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </nav>
    </aside>

    <div class="preview-body">
      <header class="preview-topbar">
        <el-button class="preview-toggle" aria-controls="preview-nav" :aria-expanded="sidebarOpen" @click="sidebarOpen = !sidebarOpen"
          >菜单</el-button
        >
        <span>系统管理员</span>
        <el-tag type="warning" effect="plain">本地模拟</el-tag>
      </header>

      <main class="preview-content">
        <div class="preview-heading">
          <div>
            <h1>{{ titles[section] }}</h1>
            <p v-if="section === 'overview'">查看资源健康和待处理的应用授权。</p>
            <p v-else-if="section === 'applications'">管理应用接入、调用授权和配额。</p>
            <p v-else-if="section === 'device'">管理密码机、接入节点和资源池配置。</p>
            <p v-else>管理上游服务地址、连接配置和转发状态。</p>
          </div>
          <el-button v-if="section === 'applications'" type="primary" @click="editApplication()">添加应用</el-button>
          <el-button v-else-if="resourceKind" type="primary" @click="editResource(resourceKind)">
            {{ resourceKind === 'device' ? '添加密码机' : '添加服务' }}
          </el-button>
        </div>

        <el-alert title="本页使用本地演示数据。请使用虚构地址和配置引用，连接测试只模拟检查结果。" type="info" :closable="false" show-icon />

        <template v-if="section === 'overview'">
          <div class="preview-metrics">
            <button @click="select('applications')">
              <span>接入应用</span><strong>{{ data.applications.length }}</strong>
            </button>
            <button @click="select('device')">
              <span>密码机</span><strong>{{ deviceCount }}</strong>
            </button>
            <div>
              <span>外部密码服务</span><strong>{{ data.resources.length - deviceCount }}</strong>
            </div>
            <button @click="select('applications', 'review')">
              <span>待审核授权</span><strong>{{ pendingCount }}</strong>
            </button>
          </div>
          <section class="preview-panel" aria-labelledby="issues-title">
            <h2 id="issues-title">资源异常</h2>
            <ul v-if="issues.length" class="preview-issues">
              <li v-for="item in issues" :key="item.id">
                <span>{{ item.name }} · {{ healthLabels[item.health] }}</span>
                <el-button link type="primary" @click="select(item.kind, 'issue')">查看{{ resourceLabels[item.kind] }}</el-button>
              </li>
            </ul>
            <p v-else>暂无已启用资源的健康异常。</p>
          </section>
        </template>

        <section v-else class="preview-panel" :aria-label="titles[section]">
          <div class="preview-filters">
            <el-input v-model="query" clearable aria-label="搜索当前列表" placeholder="搜索当前列表" />
            <el-checkbox v-if="section === 'applications'" v-model="reviewOnly">仅待审核</el-checkbox>
            <el-checkbox v-else v-model="issueOnly">仅异常</el-checkbox>
          </div>

          <el-table v-if="section === 'applications'" :data="applications" row-key="id" empty-text="暂无应用，点击「添加应用」开始接入">
            <el-table-column prop="name" label="应用名称" min-width="155" />
            <el-table-column prop="clientId" label="客户端标识" min-width="145" />
            <el-table-column prop="owner" label="负责人" min-width="110" />
            <el-table-column label="授权状态" min-width="105">
              <template #default="{ row }"
                ><el-tag effect="plain">{{ approvalLabels[row.approval as Application['approval']] }}</el-tag></template
              >
            </el-table-column>
            <el-table-column label="操作" min-width="265">
              <template #default="{ row }">
                <el-button link type="primary" @click="editApplication(row)">修改与配置</el-button>
                <el-button v-if="row.approval === 'draft'" link type="primary" @click="submitApplication(row)">提交审核</el-button>
                <el-button v-if="row.approval === 'published' || row.approval === 'pending'" link @click="disableApplication(row)">停用</el-button>
                <el-button link type="danger" @click="removeApplication(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-table v-else-if="resourceKind" :key="resourceKind" :data="resources" row-key="id" empty-text="暂无登记记录，可添加演示资源">
            <el-table-column prop="name" label="名称" min-width="165" />
            <el-table-column prop="endpoint" :label="resourceKind === 'device' ? '设备地址' : '上游地址'" min-width="170" />
            <el-table-column v-if="resourceKind === 'device'" prop="pool" label="资源池" min-width="110" />
            <el-table-column v-else prop="provider" label="协议适配器" min-width="110" />
            <el-table-column label="管理状态" min-width="95">
              <template #default="{ row }">{{ row.enabled ? '已启用' : '已停用' }}</template>
            </el-table-column>
            <el-table-column label="连接状态" min-width="100">
              <template #default="{ row }">
                <el-tag :type="row.health === 'healthy' ? 'success' : row.health === 'failed' ? 'danger' : 'info'" effect="plain">
                  {{ healthLabels[row.health as Resource['health']] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="250">
              <template #default="{ row }">
                <el-button link type="primary" @click="editResource(row.kind, row)">修改</el-button>
                <el-button link type="primary" @click="simulateConnection(row)">模拟连接</el-button>
                <el-button link @click="toggleResource(row)">{{ row.enabled ? '停用' : '启用' }}</el-button>
                <el-button link type="danger" @click="removeResource(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </main>
    </div>

    <el-dialog
      :model-value="Boolean(applicationEditor)"
      :title="applicationEditor?.id ? '修改与配置应用' : '添加应用'"
      width="min(540px, 94vw)"
      @update:model-value="(open: boolean) => !open && (applicationEditor = undefined)"
    >
      <el-form v-if="applicationEditor" label-position="top" @submit.prevent="saveApplication">
        <el-form-item label="应用名称" required><el-input v-model="applicationEditor.name" maxlength="80" /></el-form-item>
        <el-form-item label="客户端标识" required><el-input v-model="applicationEditor.clientId" maxlength="128" /></el-form-item>
        <el-form-item label="负责人" required><el-input v-model="applicationEditor.owner" maxlength="80" /></el-form-item>
        <el-form-item label="授权资源">
          <el-select v-model="applicationEditor.targets" multiple placeholder="选择密码机资源池或外部服务">
            <el-option v-for="[target, label] in targets" :key="target" :value="target" :label="label" />
          </el-select>
        </el-form-item>
        <div class="preview-form-row">
          <el-form-item label="窗口调用上限"
            ><el-input-number v-model="applicationEditor.maxRequests" :min="1" :max="1000000" :step="1" step-strictly
          /></el-form-item>
          <el-form-item label="窗口秒数"
            ><el-input-number v-model="applicationEditor.windowSeconds" :min="1" :max="3600" :step="1" step-strictly
          /></el-form-item>
        </div>
        <el-alert v-if="formError" :title="formError" type="error" :closable="false" />
        <div class="preview-dialog-actions">
          <el-button @click="applicationEditor = undefined">取消</el-button>
          <el-button type="primary" native-type="submit">保存应用</el-button>
        </div>
      </el-form>
    </el-dialog>

    <el-dialog
      :model-value="Boolean(resourceEditor)"
      :title="(resourceEditor?.id ? '修改' : '添加') + (resourceEditor ? resourceLabels[resourceEditor.kind] : '资源')"
      width="min(540px, 94vw)"
      @update:model-value="(open: boolean) => !open && (resourceEditor = undefined)"
    >
      <el-form v-if="resourceEditor" label-position="top" @submit.prevent="saveResource">
        <el-form-item label="名称" required><el-input v-model="resourceEditor.name" maxlength="80" /></el-form-item>
        <el-form-item :label="resourceEditor.kind === 'device' ? '设备地址与端口' : '上游 HTTPS 地址'" required>
          <el-input
            v-model="resourceEditor.endpoint"
            :placeholder="resourceEditor.kind === 'device' ? 'hsm.demo.invalid:8001' : 'https://service.demo.invalid'"
            maxlength="240"
          />
        </el-form-item>
        <el-form-item :label="resourceEditor.kind === 'device' ? '厂商 / Provider' : '协议适配器'" required>
          <el-input v-model="resourceEditor.provider" maxlength="80" />
        </el-form-item>
        <div v-if="resourceEditor.kind === 'device'" class="preview-form-row">
          <el-form-item label="接入节点" required><el-input v-model="resourceEditor.agent" maxlength="80" /></el-form-item>
          <el-form-item label="所属资源池" required><el-input v-model="resourceEditor.pool" maxlength="80" /></el-form-item>
        </div>
        <el-form-item v-else label="请求超时（毫秒）">
          <el-input-number v-model="resourceEditor.timeoutMs" :min="100" :max="60000" :step="100" step-strictly />
        </el-form-item>
        <el-form-item label="认证配置引用"
          ><el-input v-model="resourceEditor.credentialRef" placeholder="例如 demo/service-auth" maxlength="128"
        /></el-form-item>
        <p v-if="resourceEditor.keyBindings" class="preview-note">已有 {{ resourceEditor.keyBindings }} 个模拟密钥绑定。</p>
        <el-alert v-if="formError" :title="formError" type="error" :closable="false" />
        <div class="preview-dialog-actions">
          <el-button @click="resourceEditor = undefined">取消</el-button>
          <el-button type="primary" native-type="submit">保存资源</el-button>
        </div>
      </el-form>
    </el-dialog>
  </div>
</template>

<style src="./preview.css"></style>
