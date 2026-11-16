<template>
  <div>
    <Teleport to="body" :disabled="!fullscreen">
      <section class="board" :class="{ 'board-expanded': fullscreen }" aria-labelledby="ucsp-overview-title" :aria-busy="loading">
        <header class="board-head">
          <div>
            <h1 id="ucsp-overview-title">UCSP 运行总览</h1>
            <p v-if="snapshot">数据截至 {{ timestamp }}</p>
          </div>
          <div class="controls">
            <div class="ranges" role="group" aria-label="统计时段">
              <button v-for="option in ranges" :key="option.id" type="button" :aria-pressed="range === option.id" @click="selectRange(option.id)">
                {{ option.label }}
              </button>
            </div>
            <button type="button" :disabled="loading" @click="load()">刷新</button>
            <button ref="fullscreenButton" type="button" :aria-pressed="fullscreen" @click="toggleFullscreen">
              {{ fullscreen ? '退出大屏' : '大屏模式' }}
            </button>
          </div>
        </header>

        <p v-if="failed" class="banner" role="alert">{{ snapshot ? '刷新失败，当前展示上次成功加载的数据。' : '统计数据加载失败，请刷新重试。' }}</p>
        <p v-else-if="!snapshot" class="banner" role="status">正在加载运行数据…</p>

        <template v-if="snapshot">
          <div class="metrics" aria-label="运行指标">
            <div class="metric">
              <span>接入应用</span>
              <strong>{{ number(snapshot.applications.registered) }}</strong>
              <small>启用 {{ number(snapshot.applications.enabled) }} · 已授权 {{ number(snapshot.applications.granted) }}</small>
            </div>
            <div class="metric">
              <span>接口调用量</span>
              <strong>{{ number(calls.total) }}</strong>
              <small>{{ periodLabel }} · {{ number(snapshot.activeApplications) }} 个应用有调用</small>
            </div>
            <div class="metric success">
              <span>调用成功率</span>
              <strong>{{ calls.total ? percent.format(calls.succeeded / calls.total) : '—' }}</strong>
              <small>失败 {{ number(calls.failed) }} · 拒绝 {{ number(calls.rejected) }} · 待确认 {{ number(calls.pending) }}</small>
            </div>
            <div class="metric">
              <span>密码资源池</span>
              <strong>{{ number(poolTotal) }}</strong>
              <small>已启用 {{ number(poolEnabled) }} 个</small>
            </div>
          </div>

          <div class="board-pair">
            <section class="panel">
              <div class="panel-head">
                <h2>接口调用趋势</h2>
                <span>{{ displayedRange === 'day' ? '每 2 小时' : '每 24 小时' }} · 次</span>
              </div>
              <CallTrend v-if="calls.total" :buckets="snapshot.trend" :range="displayedRange" />
              <p v-else class="empty chart-empty">此时段暂无接口调用</p>
            </section>
            <section class="panel">
              <div class="panel-head">
                <h2>应用调用排行</h2>
                <span>{{ periodLabel }} · 次</span>
              </div>
              <ol v-if="snapshot.ranking.length" class="ranking">
                <li v-for="app in snapshot.ranking" :key="app.applicationId">
                  <div class="rank-head">
                    <span :title="app.applicationId">{{ app.name || app.applicationId }}</span>
                    <strong>{{ number(app.calls) }}</strong>
                  </div>
                  <div class="track" aria-hidden="true"><span :style="{ width: (app.calls / snapshot.ranking[0].calls) * 100 + '%' }"></span></div>
                </li>
              </ol>
              <p v-else class="empty">此时段暂无应用调用</p>
            </section>
          </div>

          <section class="panel">
            <div class="panel-head">
              <h2>密码资源池</h2>
              <router-link to="/ucsp-crypto/tsa-pools">查看时间戳资源池</router-link>
            </div>
            <div class="pools">
              <article v-for="pool in poolGroups" :key="pool.family" class="pool">
                <h3>{{ pool.label }}</h3>
                <p>
                  <strong>{{ number(pool.total) }}</strong> 个资源池
                </p>
                <small v-if="pool.total">已启用 {{ number(pool.enabled) }} · 成员 {{ number(pool.members) }}</small>
                <small v-else>暂无配置</small>
              </article>
            </div>
          </section>
        </template>
      </section>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { getOverview } from '@/api/ucsp/overview';
import type { OverviewRange, OverviewSnapshot } from '@/api/ucsp/overview';
import CallTrend from './CallTrend.vue';

const ranges = [
  { id: 'day', label: '近 24 小时' },
  { id: 'week', label: '近 7 天' }
] as const;
const families: Record<string, string> = { HSM: '密码机 HSM', TSA: '时间戳 TSA', SVS: '签名验签 SVS', SEF: '电子签章' };
const format = new Intl.NumberFormat('zh-CN');
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 });
const number = (value: number) => format.format(value);
const fullscreenButton = ref<HTMLButtonElement>();
const fullscreen = ref(false);
const range = ref<OverviewRange>('day');
const displayedRange = ref<OverviewRange>('day');
const snapshot = ref<OverviewSnapshot>();
const loading = ref(false);
const failed = ref(false);
const timestamp = computed(() => snapshot.value?.asOf.slice(0, 19).replace('T', ' '));
const periodLabel = computed(() => ranges.find(({ id }) => id === displayedRange.value)?.label);
const calls = computed(() =>
  (snapshot.value?.trend || []).reduce(
    (total, row) => ({
      total: total.total + row.total,
      succeeded: total.succeeded + row.succeeded,
      failed: total.failed + row.failed,
      rejected: total.rejected + row.rejected,
      pending: total.pending + row.pending
    }),
    { total: 0, succeeded: 0, failed: 0, rejected: 0, pending: 0 }
  )
);
const poolGroups = computed(() => {
  const groups = new Map(snapshot.value?.pools.map((pool) => [pool.family, pool]));
  return [...new Set([...Object.keys(families), ...groups.keys()])].map((family) => ({
    ...(groups.get(family) || { family, total: 0, enabled: 0, members: 0 }),
    label: families[family] || family
  }));
});
const poolTotal = computed(() => poolGroups.value.reduce((total, pool) => total + pool.total, 0));
const poolEnabled = computed(() => poolGroups.value.reduce((total, pool) => total + pool.enabled, 0));
let latest = 0;
let timer: ReturnType<typeof setInterval> | undefined;

const load = async () => {
  const id = ++latest;
  const period = range.value;
  loading.value = true;
  failed.value = false;
  try {
    const data = await getOverview(period);
    if (id === latest) {
      snapshot.value = data;
      displayedRange.value = period;
    }
  } catch {
    if (id === latest) {
      failed.value = true;
      if (snapshot.value) range.value = displayedRange.value;
    }
  } finally {
    if (id === latest) loading.value = false;
  }
};
const selectRange = (period: OverviewRange) => {
  if (range.value === period) return;
  range.value = period;
  load();
};
const toggleFullscreen = async () => {
  fullscreen.value = !fullscreen.value;
  await nextTick();
  fullscreenButton.value?.focus();
};
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && fullscreen.value) toggleFullscreen();
};
onMounted(() => {
  load();
  timer = setInterval(() => {
    if (!document.hidden && !loading.value) load();
  }, 60000);
  document.addEventListener('keydown', handleEscape);
});
onBeforeUnmount(() => {
  ++latest;
  clearInterval(timer);
  document.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.board {
  --bg: #0b1628;
  --panel: #102139;
  --line: #29405e;
  --muted: #a7bddb;
  --cyan: #73dfff;
  color: #eff6ff;
  background: radial-gradient(ellipse at 75% 0%, #173253 0%, var(--bg) 55%);
  min-height: calc(100vh - 90px);
  padding: clamp(16px, 2.4vw, 36px);
  display: grid;
  align-content: start;
  gap: 16px;
  font-variant-numeric: tabular-nums;
}
.board-expanded {
  position: fixed;
  inset: 0;
  z-index: 3000;
  overflow: auto;
  overscroll-behavior: contain;
}
.board-head,
.controls,
.panel-head,
.rank-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.board-head {
  flex-wrap: wrap;
  padding-bottom: 5px;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1 {
  font-size: clamp(24px, 2.8vw, 36px);
  letter-spacing: 0.03em;
  line-height: 1.25;
}
h2 {
  font-size: 17px;
}
h3 {
  font-size: 15px;
}
.board-head p {
  color: var(--muted);
  font-size: 13px;
  margin-top: 8px;
}
.controls {
  flex-wrap: wrap;
  justify-content: flex-start;
}
.ranges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
button {
  color: #dbe9fa;
  border: 1px solid var(--line);
  background: #142841;
  border-radius: 6px;
  min-height: 44px;
  padding: 0 12px;
  cursor: pointer;
}
button[aria-pressed='true'] {
  color: var(--cyan);
  border-color: #4c92b4;
  background: #193b54;
}
button:hover:not(:disabled) {
  border-color: var(--cyan);
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 3px;
}
.metrics,
.pools {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.metric,
.panel {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 9px;
  min-width: 0;
}
.metric {
  padding: 17px 19px;
  display: grid;
  gap: 8px;
  border-top: 2px solid #3997b8;
}
.metric strong {
  font-size: clamp(27px, 3.2vw, 44px);
  line-height: 1.15;
  color: var(--cyan);
  overflow-wrap: anywhere;
}
.metric.success strong {
  color: #67e4b4;
}
.metric > span {
  color: #d6e5f8;
  font-size: 14px;
}
.metric small,
.panel-head > span,
.pool small,
.empty {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
.board-pair {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 16px;
}
.panel {
  padding: 16px 18px;
}
.panel-head {
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.panel-head a {
  color: var(--cyan);
  font-size: 13px;
}
.ranking {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 17px;
}
.rank-head span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rank-head strong {
  color: var(--cyan);
}
.track {
  height: 6px;
  margin-top: 7px;
  border-radius: 4px;
  background: #203954;
  overflow: hidden;
}
.track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #3986bd, #71e0f7);
}
.pool {
  border: 1px solid #2b4565;
  border-radius: 7px;
  padding: 13px;
  background: #142941;
}
.pool p {
  margin: 6px 0;
  color: #ccddf2;
  font-size: 14px;
}
.pool p strong {
  color: var(--cyan);
  font-size: 24px;
}
.empty {
  display: grid;
  place-items: center;
  min-height: 140px;
  text-align: center;
}
.chart-empty {
  min-height: 254px;
}
.banner {
  background: #18314d;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 12px;
  color: #dcecff;
}
.banner[role='alert'] {
  color: #ffdfad;
}
@media (max-width: 1080px) {
  .metrics,
  .pools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 780px) {
  .board-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 380px) {
  .metrics,
  .pools {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
