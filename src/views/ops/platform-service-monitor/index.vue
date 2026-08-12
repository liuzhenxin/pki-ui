<template>
  <div class="ops-page">
    <div class="ops-toolbar">
      <div>
        <h2>{{ title }}</h2>
        <span>最近采集时间：{{ dateTimeText(overview?.collectedAt) }}</span>
      </div>
      <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <el-card shadow="never" class="ops-panel">
      <el-skeleton :loading="loading" animated :rows="6">
        <el-empty v-if="!component" description="暂未采集到该服务的部署信息" />
        <el-descriptions v-else :column="2" border>
          <el-descriptions-item label="服务名称">{{ component.displayName }}</el-descriptions-item>
          <el-descriptions-item label="服务编码">{{ component.name }}</el-descriptions-item>
          <el-descriptions-item label="运行状态">
            <el-tag :type="statusTagType(component.container?.state, component.container?.running, component.container?.present)" effect="plain">
              {{ statusText(component.container?.state, component.container?.running, component.container?.present) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="容器名称">{{ component.container?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="镜像" :span="2">{{ component.container?.image || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态说明" :span="2">{{ component.container?.status || '-' }}</el-descriptions-item>
          <el-descriptions-item label="依赖服务" :span="2">
            <el-tag v-for="dependency in component.dependencies" :key="dependency" class="dependency" size="small" effect="plain">
              {{ dependency }}
            </el-tag>
            <span v-if="!component.dependencies?.length">无</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-skeleton>
    </el-card>
  </div>
</template>

<script setup name="OpsPlatformServiceMonitor" lang="ts">
import { getOpsOverview } from '@/api/ops';
import type { OpsComponent, OpsOverview } from '@/api/ops/types';
import { dateTimeText, statusTagType, statusText } from '@/views/ops/utils';

const route = useRoute();
const loading = ref(false);
const overview = ref<OpsOverview>();

const serviceCode = computed(() => String(route.path).split('/').filter(Boolean).at(-1) || '');
const componentCode = computed(() => `liuzx-${serviceCode.value}`);
const component = computed<OpsComponent | undefined>(() =>
  overview.value?.layers.flatMap((layer) => layer.components).find((item) => item.name === componentCode.value)
);
const title = computed(() => `${serviceCode.value.toUpperCase()}服务监控`);

const loadData = async () => {
  loading.value = true;
  try {
    overview.value = await getOpsOverview();
  } finally {
    loading.value = false;
  }
};

watch(() => route.path, loadData);
onMounted(loadData);
</script>

<style scoped lang="scss">
.ops-page {
  padding: 12px;
}

.ops-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  h2 {
    margin: 0 0 4px;
    color: #1f2937;
    font-size: 20px;
    font-weight: 600;
  }

  span {
    color: #6b7280;
    font-size: 13px;
  }
}

.ops-panel {
  border-radius: 8px;
}

.dependency {
  margin-right: 6px;
}
</style>
