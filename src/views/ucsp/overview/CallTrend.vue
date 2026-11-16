<template>
  <div ref="plot" class="plot" role="img" aria-label="接口调用量与成功量趋势"></div>
  <details class="readout">
    <summary>查看各时段数据</summary>
    <div class="readout-table">
      <table>
        <thead>
          <tr>
            <th scope="col">时段起点</th>
            <th scope="col">调用</th>
            <th scope="col">成功</th>
            <th scope="col">失败</th>
            <th scope="col">拒绝</th>
            <th scope="col">待确认</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bucket in buckets" :key="bucket.from">
            <th scope="row">{{ bucket.from.slice(0, 16).replace('T', ' ') }}</th>
            <td>{{ bucket.total }}</td>
            <td>{{ bucket.succeeded }}</td>
            <td>{{ bucket.failed }}</td>
            <td>{{ bucket.rejected }}</td>
            <td>{{ bucket.pending }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { init, use } from 'echarts/core';
import type { EChartsType } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { OverviewBucket, OverviewRange } from '@/api/ucsp/overview';

use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ buckets: OverviewBucket[]; range: OverviewRange }>();
const plot = ref<HTMLElement>();
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;

const draw = () => {
  chart?.setOption({
    animation: false,
    color: ['#63dcff', '#67e4b4'],
    tooltip: { trigger: 'axis', confine: true },
    legend: { textStyle: { color: '#c6d6ee' }, right: 0 },
    grid: { left: 48, right: 20, top: 46, bottom: 32 },
    xAxis: {
      type: 'category',
      data: props.buckets.map(({ from }) => (props.range === 'day' ? from.slice(11, 16) : from.slice(5, 10))),
      axisLabel: { color: '#a7bbd8', hideOverlap: true },
      axisLine: { lineStyle: { color: '#314667' } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#a7bbd8' },
      splitLine: { lineStyle: { color: '#243955' } }
    },
    series: [
      { name: '调用量', type: 'line', data: props.buckets.map(({ total }) => total), areaStyle: { opacity: 0.14 }, showSymbol: false },
      {
        name: '成功量',
        type: 'line',
        data: props.buckets.map(({ succeeded }) => succeeded),
        symbol: 'diamond',
        lineStyle: { type: 'dashed' }
      }
    ]
  });
};

onMounted(() => {
  if (!plot.value) return;
  chart = init(plot.value);
  draw();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(plot.value);
});
watch(() => [props.buckets, props.range], draw);
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>

<style scoped>
.plot {
  height: 254px;
}
.readout {
  color: #b7cae5;
  font-size: 13px;
}
summary {
  cursor: pointer;
  width: fit-content;
  padding: 6px 0;
}
.readout-table {
  overflow: auto;
}
table {
  width: 100%;
  text-align: right;
  white-space: nowrap;
}
th,
td {
  padding: 5px;
}
th:first-child {
  text-align: left;
}
</style>
