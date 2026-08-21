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
        <div class="topology-architecture">
          <div class="external-entry">
            <span>流量来源</span>
            <b>客户端 / 上级负载设备</b>
          </div>
          <div v-if="topologyRows.length" class="flow-connector" aria-hidden="true"><span>↓</span></div>

          <template v-for="(row, rowIndex) in topologyRows" :key="row.map((layer) => layer.code).join('-')">
            <div class="topology-row" :class="{ 'is-parallel': row.length > 1 }">
              <section v-for="layer in row" :key="layer.code" class="topology-layer">
                <div class="layer-title">
                  <div class="stack-identity">
                    <b>{{ stackName(layer.code) }}</b>
                    <span>{{ layer.name }}</span>
                  </div>
                  <el-tag effect="plain">{{ layer.components.length }} 个组件</el-tag>
                </div>
                <div class="component-list">
                  <article v-for="component in layer.components" :key="component.name" class="component-item">
                    <div class="component-head">
                      <div>
                        <b>{{ component.displayName }}</b>
                        <span>{{ component.name }}</span>
                      </div>
                      <el-tag
                        :type="statusTagType(component.container?.state, component.container?.running, component.container?.present)"
                        effect="plain"
                      >
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

            <div
              v-if="rowIndex < topologyRows.length - 1"
              class="flow-connector"
              :class="{ 'is-split': topologyRows[rowIndex + 1]?.length > 1, 'is-merge': row.length > 1 }"
              aria-hidden="true"
            >
              <span>{{ topologyRows[rowIndex + 1]?.length > 1 ? '↙　↘' : row.length > 1 ? '↘　↙' : '↓' }}</span>
            </div>
          </template>
        </div>
      </el-skeleton>
    </el-card>
  </div>
</template>

<script setup name="OpsComponent" lang="ts">
import { getOpsOverview } from '@/api/ops';
import type { OpsLayer, OpsOverview } from '@/api/ops/types';
import { dateTimeText, statusTagType, statusText } from '@/views/ops/utils';

const loading = ref(false);
const overview = ref<OpsOverview>();
const stackNames: Record<string, string> = {
  ui: 'pki-ui-stack',
  gateway: 'pki-gateway-stack',
  platform: 'pki-platform-stack',
  domain: 'pki-domain-stack',
  discovery: 'pki-discovery-stack',
  infrastructure: 'pki-infra-stack'
};

const topologyRows = computed<OpsLayer[][]>(() => {
  const layers = new Map((overview.value?.layers || []).map((layer) => [layer.code, layer]));
  return [['ui'], ['gateway'], ['platform', 'domain'], ['discovery'], ['infrastructure']]
    .map((codes) => codes.map((code) => layers.get(code)).filter((layer): layer is OpsLayer => Boolean(layer)))
    .filter((row) => row.length > 0);
});

const stackName = (code: string) => stackNames[code] || `${code}-stack`;

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

.topology-architecture {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px 20px;
}

.external-entry {
  width: min(100%, 720px);
  padding: 16px 20px;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff, #eef2ff);
  text-align: center;

  span,
  b {
    display: block;
  }

  span {
    margin-bottom: 4px;
    color: #64748b;
    font-size: 12px;
  }

  b {
    color: #1e3a8a;
    font-size: 16px;
  }
}

.flow-connector {
  position: relative;
  display: flex;
  width: 40px;
  height: 38px;
  align-items: center;
  justify-content: center;
  color: #64748b;

  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background: #cbd5e1;
    content: '';
    transform: translateX(-50%);
  }

  span {
    position: relative;
    z-index: 1;
    padding: 0 5px;
    background: #fff;
    font-size: 20px;
    line-height: 1;
  }

  &.is-split,
  &.is-merge {
    width: 220px;

    &::before {
      display: none;
    }

    span {
      padding: 0;
      color: #64748b;
      font-size: 24px;
      letter-spacing: 18px;
      white-space: nowrap;
    }
  }
}

.topology-row {
  display: grid;
  width: min(100%, 960px);
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;

  &.is-parallel {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.topology-layer {
  min-width: 0;
  padding: 16px;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  background: #f8fafc;
  box-shadow: 0 6px 18px rgb(15 23 42 / 6%);
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
  margin-bottom: 14px;

  b {
    color: #0f172a;
  }
}

.stack-identity {
  min-width: 0;

  b,
  span {
    display: block;
  }

  b {
    font-size: 16px;
  }

  span {
    margin-top: 3px;
    color: #64748b;
    font-size: 12px;
  }
}

.component-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

@media (max-width: 768px) {
  .topology-architecture {
    padding-inline: 0;
  }

  .topology-row.is-parallel {
    grid-template-columns: 1fr;
  }

  .topology-layer {
    padding: 12px;
  }

  .component-list {
    grid-template-columns: 1fr;
  }
}
</style>
