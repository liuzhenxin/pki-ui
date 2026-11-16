<template>
  <el-card class="m-2" shadow="never" v-loading="loading">
    <template #header>
      <h2 class="m-0 text-lg font-semibold">{{ title }}</h2>
    </template>
    <slot name="toolbar" :reload="reload" />
    <el-alert v-if="failed" title="查询失败，请重试。" type="error" :closable="false" show-icon class="mb-3" />
    <el-table :data="rows" empty-text="暂无记录">
      <slot />
    </el-table>
    <div class="mt-3 flex items-center gap-2">
      <el-button :disabled="loading || offset === 0" @click="load(offset - pageSize)">上一页</el-button>
      <span>第 {{ offset / pageSize + 1 }} 页</span>
      <el-button :disabled="loading || !hasMore" @click="load(offset + pageSize)">下一页</el-button>
      <el-button :disabled="loading" @click="load(offset)">刷新</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts" generic="T">
import { onMounted, ref, shallowRef } from 'vue';
import type { AuditPage } from '@/api/ucsp/audit';

const props = defineProps<{ title: string; query: (offset: number) => Promise<AuditPage<T>> }>();
const pageSize = 25;
const rows = shallowRef<T[]>([]);
const offset = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const failed = ref(false);
let request = 0;

const load = async (nextOffset: number) => {
  const pending = ++request;
  loading.value = true;
  failed.value = false;
  try {
    const result = await props.query(nextOffset);
    if (pending === request) {
      rows.value = result.rows;
      offset.value = nextOffset;
      hasMore.value = result.hasMore;
    }
  } catch {
    if (pending === request) {
      rows.value = [];
      hasMore.value = false;
      failed.value = true;
    }
  } finally {
    if (pending === request) loading.value = false;
  }
};
const reload = () => load(0);
onMounted(reload);
</script>
