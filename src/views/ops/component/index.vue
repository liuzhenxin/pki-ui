<template>
  <div class="ops-page">
    <div class="ops-toolbar">
      <div>
        <h2>组件拓扑</h2>
        <span>最近采集时间：{{ dateTimeText(overview?.collectedAt) }}</span>
      </div>
      <el-button type="primary" icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </div>

    <el-card shadow="never" class="ops-panel">
      <el-skeleton :loading="loading" animated :rows="10">
        <div class="topology">
          <section v-for="layer in overview?.layers || []" :key="layer.code" class="topology-layer">
            <div class="layer-title">
              <b>{{ layer.name }}</b>
              <el-tag effect="plain">{{ layer.components.length }} 个组件</el-tag>
            </div>
            <div class="component-list">
              <article v-for="component in layer.components" :key="component.name" class="component-item">
                <div class="component-head">
                  <div>
                    <b>{{ component.displayName }}</b>
                    <span>{{ component.name }}</span>
                  </div>
                  <el-tag :type="statusTagType(component.container?.state, component.container?.running, component.container?.present)" effect="plain">
                    {{ statusText(component.container?.state, component.container?.running, component.container?.present) }}
                  </el-tag>
                </div>
                <div class="component-container">
                  <span>容器</span>
                  <b>{{ component.container?.name || '-' }}</b>
                </div>
                <div class="component-image">
                  <span>镜像</span>
                  <b>{{ component.container?.image || '-' }}</b>
                </div>
                <div class="dependency-list">
                  <el-tag v-for="dep in component.dependencies" :key="dep" size="small" effect="plain">{{ dep }}</el-tag>
                  <span v-if="!component.dependencies?.length">无前置依赖</span>
                </div>
              </article>
            </div>
          </section>
        </div>
      </el-skeleton>
    </el-card>
  </div>
</template>

<script setup name="OpsComponent" lang="ts">
import { getOpsOverview } from '@/api/ops';
import type { OpsOverview } from '@/api/ops/types';
import { dateTimeText, statusTagType, statusText } from '@/views/ops/utils';

const loading = ref(false);
const overview = ref<OpsOverview>();

const loadData = async () => {
  loading.value = true;
  try {
    overview.value = await getOpsOverview();
  } finally {
    loading.value = false;
  }
};

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
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }

  span {
    color: #6b7280;
    font-size: 13px;
  }
}

.ops-panel {
  border-radius: 8px;
}

.topology {
  display: grid;
  grid-template-columns: repeat(4, minmax(230px, 1fr));
  gap: 12px;
}

.topology-layer {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.layer-title,
.component-head,
.component-container,
.component-image {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.layer-title {
  align-items: center;
  margin-bottom: 12px;

  b {
    color: #111827;
  }
}

.component-list {
  display: grid;
  gap: 10px;
}

.component-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.component-head {
  margin-bottom: 10px;

  b,
  span {
    display: block;
  }

  b {
    color: #111827;
  }

  span {
    margin-top: 3px;
    color: #6b7280;
    font-size: 12px;
  }
}

.component-container,
.component-image {
  margin-top: 8px;
  color: #6b7280;
  font-size: 12px;

  b {
    max-width: 70%;
    overflow: hidden;
    color: #374151;
    font-weight: 500;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.dependency-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
  margin-top: 10px;
  color: #9ca3af;
  font-size: 12px;
}

@media (max-width: 1400px) {
  .topology {
    grid-template-columns: repeat(2, minmax(230px, 1fr));
  }
}

@media (max-width: 768px) {
  .topology {
    grid-template-columns: 1fr;
  }
}
</style>
