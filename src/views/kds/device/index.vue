<template>
  <div class="app-container kds-page kds-device">
    <KdsPageHeader title="设备管理" description="查看已注册 MMJ 的身份、证书有效期、运行状态及通道配置。">
      <template #actions>
        <el-button icon="Refresh" :loading="loading" @click="reload">刷新设备</el-button>
      </template>
    </KdsPageHeader>
    <el-card v-loading="loading" shadow="hover" class="kds-panel">
      <template #header><div class="kds-panel__header"><span>设备列表</span><span class="kds-muted">共 {{ total }} 台</span></div></template>
      <el-form inline class="kds-filter-form">
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px" @change="reload">
            <el-option label="ACTIVE" value="ACTIVE" />
            <el-option label="DISABLED" value="DISABLED" />
            <el-option label="REVOKED" value="REVOKED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="reload">查询</el-button>
        </el-form-item>
      </el-form>

      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />

      <el-table :data="items" border size="small">
        <el-table-column prop="deviceSn" label="设备序列号" min-width="200" />
        <el-table-column prop="deviceType" label="类型" width="100" />
        <el-table-column prop="role" label="角色" width="120" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : row.status === 'DISABLED' ? 'info' : 'danger'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notAfter" label="证书到期" min-width="180" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" icon="View" @click="openDetail(row.deviceSn)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无设备</template>
      </el-table>

      <el-pagination
        class="mt"
        layout="total, prev, pager, next"
        :total="total"
        :current-page="query.page"
        :page-size="query.size"
        @current-change="onPage"
      />
    </el-card>

    <el-drawer v-model="drawer" size="min(720px, 94vw)" class="device-detail-drawer" destroy-on-close>
      <template #header>
        <div class="drawer-title">
          <span>设备详情</span>
          <span class="drawer-subtitle">身份、证书与运行配置</span>
        </div>
      </template>

      <div v-loading="detailLoading" class="detail-content">
        <template v-if="detail">
          <section class="identity-card">
            <div class="device-avatar" aria-hidden="true">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="identity-main">
              <div class="identity-heading">
                <span class="device-sn">{{ detail.deviceSn }}</span>
                <el-tag :type="statusTagType(detail.status)" effect="light" round>{{ statusLabel(detail.status) }}</el-tag>
              </div>
              <div class="identity-meta">
                <span><el-icon><Key /></el-icon>{{ roleLabel(detail.role) }}</span>
                <span><el-icon><Connection /></el-icon>{{ Object.keys(detail.channels || {}).length }} 个通道</span>
                <span><el-icon><SetUp /></el-icon>S 盒 {{ detail.sBoxVersion || '未部署' }}</span>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-heading">
              <div>
                <h3>设备身份</h3>
                <p>注册角色与证书有效期</p>
              </div>
              <el-tag :type="certificateState.type" effect="plain">{{ certificateState.label }}</el-tag>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">设备角色</span>
                <strong>{{ roleLabel(detail.role) }}</strong>
              </div>
              <div class="info-item">
                <span class="info-label">证书生效</span>
                <strong>{{ formatDateTime(detail.notBefore) }}</strong>
              </div>
              <div class="info-item">
                <span class="info-label">证书到期</span>
                <strong>{{ formatDateTime(detail.notAfter) }}</strong>
              </div>
              <div class="info-item info-item--wide">
                <span class="info-label">SHA-256 证书指纹</span>
                <div class="fingerprint-row">
                  <code>{{ groupedFingerprint }}</code>
                  <el-button v-if="detail.certificateSha256" link type="primary" aria-label="复制证书指纹" @click="copyFingerprint">
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-button>
                </div>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-heading">
              <div>
                <h3>运行配置</h3>
                <p>当前生效的通道与 S 盒版本</p>
              </div>
            </div>
            <div class="runtime-summary">
              <div class="runtime-metric">
                <span>S 盒版本</span>
                <strong>{{ detail.sBoxVersion || '未部署' }}</strong>
              </div>
              <div class="runtime-metric">
                <span>通道数量</span>
                <strong>{{ channelRows.length }}</strong>
              </div>
              <div class="runtime-metric">
                <span>待处理事项</span>
                <strong :class="{ 'text-warning': detail.pending.length }">{{ detail.pending.length }}</strong>
              </div>
            </div>
            <div v-if="channelRows.length" class="tag-list" aria-label="通道绑定">
              <div v-for="item in channelRows" :key="item.name" class="binding-row">
                <span class="binding-name">{{ item.name }}</span>
                <code>{{ item.value }}</code>
              </div>
            </div>
            <el-empty v-else :image-size="56" description="暂无通道绑定" />
          </section>

          <section class="detail-section">
            <div class="section-heading">
              <div>
                <h3>依赖状态</h3>
                <p>设备关联服务的最近状态</p>
              </div>
            </div>
            <div v-if="dependencyRows.length" class="dependency-grid">
              <div v-for="item in dependencyRows" :key="item.name" class="dependency-item">
                <span class="status-dot" :class="dependencyClass(item.value)" aria-hidden="true" />
                <span>{{ item.name }}</span>
                <el-tag :type="dependencyTagType(item.value)" size="small" effect="plain">{{ item.value }}</el-tag>
              </div>
            </div>
            <el-empty v-else :image-size="56" description="暂无依赖状态" />
          </section>

          <el-alert
            v-if="detail.pending.length"
            type="warning"
            show-icon
            :closable="false"
            title="存在待处理事项"
            :description="detail.pending.join('；')"
          />
          <el-alert v-else type="success" show-icon :closable="false" title="当前没有待处理事项" />
        </template>
        <el-empty v-else-if="!detailLoading" description="未获取到设备详情" />
      </div>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import KdsPageHeader from '@/views/kds/components/KdsPageHeader.vue';
import { getDeviceDetail, listDevices } from '@/api/kds/device';
import { toKdsError } from '@/api/kds/client';
import type { DeviceDetail, DeviceView } from '@/types/kds';

const items = ref<DeviceView[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const drawer = ref(false);
const detail = ref<DeviceDetail>();
const detailLoading = ref(false);
const query = reactive<{ status?: string; page: number; size: number }>({ status: undefined, page: 1, size: 20 });

const channelRows = computed(() => Object.entries(detail.value?.channels || {}).map(([name, value]) => ({ name, value })));
const dependencyRows = computed(() => Object.entries(detail.value?.dependencies || {}).map(([name, value]) => ({ name, value })));
const groupedFingerprint = computed(() => detail.value?.certificateSha256?.match(/.{1,8}/g)?.join(' ') || '-');
const certificateState = computed(() => {
  if (!detail.value?.notAfter) return { label: '有效期未知', type: 'info' as const };
  const remaining = new Date(detail.value.notAfter).getTime() - Date.now();
  if (remaining <= 0) return { label: '证书已过期', type: 'danger' as const };
  if (remaining <= 30 * 24 * 60 * 60 * 1000) return { label: '即将到期', type: 'warning' as const };
  return { label: '证书有效', type: 'success' as const };
});

function statusTagType(status: string) {
  return status === 'ACTIVE' ? 'success' : status === 'DISABLED' ? 'info' : 'danger';
}

function statusLabel(status: string) {
  return { ACTIVE: '运行中', DISABLED: '已停用', REVOKED: '已吊销' }[status] || status;
}

function roleLabel(role: string) {
  return { ADMIN: '系统管理员', KEY_ADMIN: '密钥管理员', AUDITOR: '审计管理员' }[role] || role;
}

function formatDateTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function dependencyTagType(value: string) {
  const state = value.toUpperCase();
  return state === 'UP' || state === 'HEALTHY' || state === 'ONLINE' ? 'success' : state === 'UNKNOWN' ? 'info' : 'danger';
}

function dependencyClass(value: string) {
  return `is-${dependencyTagType(value)}`;
}

async function copyFingerprint() {
  if (!detail.value?.certificateSha256) return;
  try {
    await navigator.clipboard.writeText(detail.value.certificateSha256);
    ElMessage.success('证书指纹已复制');
  } catch {
    ElMessage.error('复制失败，请手动选择指纹');
  }
}

async function reload() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listDevices({ status: query.status, page: query.page, size: query.size });
    items.value = result.items || [];
    total.value = result.total || 0;
  } catch (e) {
    error.value = toKdsError(e).message;
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onPage(page: number) {
  query.page = page;
  reload();
}

async function openDetail(deviceSn: string) {
  drawer.value = true;
  detail.value = undefined;
  detailLoading.value = true;
  try {
    detail.value = await getDeviceDetail(deviceSn);
  } catch (e) {
    error.value = toKdsError(e).message;
    drawer.value = false;
  } finally {
    detailLoading.value = false;
  }
}

onMounted(reload);
</script>
<style scoped>
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
.drawer-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 600;
}
.drawer-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}
.detail-content {
  min-height: 260px;
}
.identity-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color) 68%);
}
.device-avatar {
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  place-items: center;
  border-radius: 12px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 26px;
  box-shadow: 0 8px 18px var(--el-color-primary-light-7);
}
.identity-main {
  min-width: 0;
  flex: 1;
}
.identity-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.device-sn {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 650;
}
.identity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 9px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.identity-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.detail-section {
  padding: 18px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.section-heading h3,
.section-heading p {
  margin: 0;
}
.section-heading h3 {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
}
.section-heading p {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.info-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.info-item--wide {
  grid-column: 1 / -1;
}
.info-item strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
}
.info-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.fingerprint-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.fingerprint-row code,
.binding-row code {
  overflow-wrap: anywhere;
  color: var(--el-text-color-regular);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}
.runtime-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.runtime-metric {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.runtime-metric span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.runtime-metric strong {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 17px;
}
.text-warning {
  color: var(--el-color-warning) !important;
}
.tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.binding-row {
  display: grid;
  grid-template-columns: minmax(96px, 0.35fr) minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  padding: 10px 12px;
  border-radius: 7px;
  background: var(--el-fill-color-light);
}
.binding-name {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}
.dependency-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.dependency-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger);
}
.status-dot.is-success {
  background: var(--el-color-success);
}
.status-dot.is-info {
  background: var(--el-color-info);
}
@media (max-width: 640px) {
  .identity-card {
    align-items: flex-start;
    padding: 16px;
  }
  .identity-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .info-grid,
  .dependency-grid {
    grid-template-columns: 1fr;
  }
  .runtime-summary {
    grid-template-columns: 1fr;
  }
  .fingerprint-row {
    flex-direction: column;
  }
  .binding-row {
    grid-template-columns: 1fr;
  }
}
</style>
<style src="../styles/page.css"></style>
