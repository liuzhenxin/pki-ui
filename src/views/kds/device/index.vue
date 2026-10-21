<template>
  <div class="kds-device">
    <el-card v-loading="loading">
      <template #header><span>设备管理</span></template>
      <el-form inline>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px" @change="reload">
            <el-option label="ACTIVE" value="ACTIVE" />
            <el-option label="DISABLED" value="DISABLED" />
            <el-option label="REVOKED" value="REVOKED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">查询</el-button>
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
            <el-button link type="primary" @click="openDetail(row.deviceSn)">详情</el-button>
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

    <el-drawer v-model="drawer" title="设备详情" size="560px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="设备序列号">{{ detail.deviceSn }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ detail.role }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
        <el-descriptions-item label="证书指纹">{{ detail.certificateSha256 || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书生效">{{ detail.notBefore }}</el-descriptions-item>
        <el-descriptions-item label="证书到期">{{ detail.notAfter }}</el-descriptions-item>
        <el-descriptions-item label="S 盒版本">{{ detail.sBoxVersion || '-' }}</el-descriptions-item>
        <el-descriptions-item label="通道">{{ formatMap(detail.channels) }}</el-descriptions-item>
        <el-descriptions-item label="依赖">{{ formatMap(detail.dependencies) }}</el-descriptions-item>
        <el-descriptions-item label="待处理">{{ detail.pending.join('，') || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getDeviceDetail, listDevices } from '@/api/kds/device';
import { toKdsError } from '@/api/kds/client';
import type { DeviceDetail, DeviceView } from '@/types/kds';

const items = ref<DeviceView[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const drawer = ref(false);
const detail = ref<DeviceDetail>();
const query = reactive<{ status?: string; page: number; size: number }>({ status: undefined, page: 1, size: 20 });

function formatMap(map: Record<string, string>) {
  const entries = Object.entries(map || {});
  return entries.length === 0 ? '-' : entries.map(([k, v]) => `${k}=${v}`).join('，');
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
  try {
    detail.value = await getDeviceDetail(deviceSn);
    drawer.value = true;
  } catch (e) {
    error.value = toKdsError(e).message;
  }
}

onMounted(reload);
</script>
<style scoped>
.kds-device {
  padding: 20px;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
</style>
