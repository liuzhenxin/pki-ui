<template>
  <section aria-label="员工证书">
    <el-alert v-if="failed" title="员工证书加载失败" type="error" :closable="false">
      <el-button link type="primary" @click="$emit('retry')">重新加载</el-button>
    </el-alert>
    <el-table v-else v-loading="loading" :data="rows" row-key="id" size="small" empty-text="暂无员工证书">
      <el-table-column label="证书序列号" prop="serialNumber" min-width="175" show-overflow-tooltip />
      <el-table-column label="证书模板" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.profileName || '未关联模板' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="96">
        <template #default="{ row }">
          <el-tag :type="STATUS[row.status as EmployeeCertificateRecord['status']]?.type || 'info'">
            {{ STATUS[row.status as EmployeeCertificateRecord['status']]?.label || '状态未知' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="到期时间" width="165">
        <template #default="{ row }">{{ time(row.notAfter) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center">
        <template #default="{ row }">
          <div class="certificate-actions">
            <el-tooltip content="证书详情">
              <el-button link type="primary" icon="View" aria-label="证书详情" @click="$emit('certificate', row.id)" />
            </el-tooltip>
            <el-tooltip v-if="adUploadEnabled && row.adUploadEligible" content="上传AD">
              <span><el-button link type="primary" icon="Upload" aria-label="上传 AD" disabled /></span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="!failed && total > pageSize"
      class="certificate-pagination"
      size="small"
      layout="prev, pager, next, total"
      :pager-count="5"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      :disabled="loading"
      @update:current-page="$emit('page-change', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import type { EmployeeCertificateRecord } from '@/api/ra/employee';

defineProps<{
  rows: EmployeeCertificateRecord[];
  loading: boolean;
  failed: boolean;
  page: number;
  pageSize: number;
  total: number;
  adUploadEnabled?: boolean;
}>();
defineEmits<{ 'page-change': [page: number]; retry: []; certificate: [id: string] }>();

const STATUS = {
  VALID: { label: '有效', type: 'success' },
  NOT_YET_VALID: { label: '尚未生效', type: 'info' },
  EXPIRED: { label: '已过期', type: 'warning' },
  HOLD: { label: '已冻结', type: 'warning' },
  REVOKED: { label: '已吊销', type: 'danger' },
  UNKNOWN: { label: '状态未知', type: 'info' }
} as const;

function time(value?: string) {
  return value?.replace('T', ' ').slice(0, 19) || '-';
}
</script>

<style scoped>
.certificate-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.certificate-pagination {
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
