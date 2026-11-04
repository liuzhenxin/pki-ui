<template>
  <div class="hsm-page">
    <HsmPageHeader title="身份审计" description="查看服务端返回的最近 100 条 UKey 身份操作记录。筛选仅作用于已加载记录。">
      <el-button :loading="loading" @click="refresh">刷新记录</el-button>
    </HsmPageHeader>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="hsm-section" />
    <el-card class="hsm-section" v-loading="loading">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="搜索"><el-input v-model="query" clearable placeholder="操作、账号、摘要" /></el-form-item>
        <el-form-item label="结果"
          ><el-select v-model="outcome" clearable placeholder="全部结果" style="width: 160px"
            ><el-option v-for="value in outcomes" :key="value" :value="value" :label="auditOutcomeLabel(value)" /></el-select
        ></el-form-item>
        <el-form-item><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <div class="hsm-table-wrap">
        <el-table :data="pageRows" empty-text="暂无匹配的身份操作记录" min-height="240">
          <el-table-column prop="occurredAt" label="时间" min-width="180" />
          <el-table-column prop="operation" label="操作" min-width="160" />
          <el-table-column prop="userId" label="平台账号 ID" min-width="110" />
          <el-table-column label="结果" min-width="100"
            ><template #default="{ row }"
              ><el-tag :type="row.outcome === 'SUCCESS' ? 'success' : 'info'">{{ auditOutcomeLabel(row.outcome) }}</el-tag></template
            ></el-table-column
          >
          <el-table-column prop="summary" label="摘要" min-width="260" show-overflow-tooltip />
        </el-table>
      </div>
      <el-pagination v-model:current-page="page" :total="filtered.length" :page-size="10" layout="total, prev, pager, next" class="hsm-section" />
      <p class="hsm-muted">已加载 {{ events.length }} 条。此处仅包含设备 UKey 身份事件，完整平台审计需在平台审计模块查询。</p>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getUkeyStatus, type UkeyStatus } from '@/api/hsm/ukeys';
import { auditOutcomeLabel } from '@/utils/hsmPresentation';
import HsmPageHeader from '../components/HsmPageHeader.vue';
import '../styles/product.css';

const events = ref<UkeyStatus['auditEvents']>([]);
const loading = ref(false);
const error = ref('');
const query = ref('');
const outcome = ref('');
const page = ref(1);
const outcomes = computed(() => [...new Set(events.value.map((event) => event.outcome))]);
const filtered = computed(() =>
  events.value.filter(
    (event) =>
      (!outcome.value || event.outcome === outcome.value) &&
      `${event.operation} ${event.userId} ${event.summary}`.toLowerCase().includes(query.value.trim().toLowerCase())
  )
);
const pageRows = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10));
watch([query, outcome], () => {
  page.value = 1;
});
function reset() {
  query.value = '';
  outcome.value = '';
  page.value = 1;
}
async function refresh() {
  if (loading.value) return;
  loading.value = true;
  events.value = [];
  error.value = '';
  page.value = 1;
  try {
    events.value = (await getUkeyStatus()).data.auditEvents;
  } catch {
    error.value = '身份审计查询失败，请检查登录权限和服务连接后重试。';
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);
</script>
