<template>
  <div v-if="!hidden && normalizedTotal > 0" class="pagination-container">
    <el-pagination
      :key="paginationKey"
      :default-current-page="normalizedPage"
      :default-page-size="normalizedLimit"
      :background="background"
      :layout="layout"
      :page-sizes="pageSizes"
      :pager-count="pagerCount"
      :total="normalizedTotal"
      @change="handlePaginationChange"
    />
  </div>
</template>

<script setup name="Pagination" lang="ts">
import { scrollTo } from '@/utils/scroll-to';
import { propTypes } from '@/utils/propTypes';

const props = defineProps({
  total: propTypes.number,
  page: propTypes.number.def(1),
  limit: propTypes.number.def(20),
  pageSizes: { type: Array<number>, default: () => [10, 20, 30, 50] },
  // 移动端页码按钮的数量端默认值5
  pagerCount: propTypes.number.def(document.body.clientWidth < 992 ? 5 : 7),
  layout: propTypes.string.def('total, sizes, prev, pager, next, jumper'),
  background: propTypes.bool.def(true),
  autoScroll: propTypes.bool.def(true),
  hidden: propTypes.bool.def(false),
  float: propTypes.string.def('right')
});

const emit = defineEmits(['update:page', 'update:limit', 'pagination']);
const normalizedPage = computed(() => Number(props.page) || 1);
const normalizedLimit = computed(() => Number(props.limit) || 20);
const normalizedTotal = computed(() => Number(props.total) || 0);
const paginationKey = computed(() => `${normalizedPage.value}-${normalizedLimit.value}-${normalizedTotal.value}`);

function handlePaginationChange(page: number, limit: number) {
  if (page * limit > normalizedTotal.value) {
    page = 1;
  }
  emit('update:page', page);
  emit('update:limit', limit);
  emit('pagination', { page, limit });
  if (props.autoScroll) {
    scrollTo(0, 800);
  }
}
</script>

<style lang="scss" scoped>
.pagination-container {
  .el-pagination {
    float: v-bind(float);
  }
}
</style>
