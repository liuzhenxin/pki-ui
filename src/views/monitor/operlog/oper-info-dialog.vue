<template>
  <el-dialog v-model="open" title="操作日志详细" width="700px" append-to-body close-on-click-modal @closed="info = null">
    <el-descriptions v-if="info" :column="1" border>
      <el-descriptions-item label="操作状态">
        <template #default>
          <el-tag v-if="info.status === 0" type="success">正常</el-tag>
          <el-tag v-else-if="info.status === 1" type="danger">失败</el-tag>
        </template>
      </el-descriptions-item>
      <el-descriptions-item label="登录信息">
        <template #default> {{ info.operName }} / {{ info.deptName }} / {{ info.operIp }} / {{ info.operLocation }} </template>
      </el-descriptions-item>
      <el-descriptions-item label="请求信息">
        <template #default> {{ info.requestMethod }} {{ info.operUrl }} </template>
      </el-descriptions-item>
      <el-descriptions-item label="操作模块">
        <template #default>
          {{ info.title }}
          <template v-if="operationLabel(info)"> / {{ operationLabel(info) }} </template>
        </template>
      </el-descriptions-item>
      <el-descriptions-item label="操作方法">
        <template #default>
          {{ info.method }}
        </template>
      </el-descriptions-item>
      <el-descriptions-item label="消耗时间">
        <template #default>
          <span> {{ info.costTime }}ms </span>
        </template>
      </el-descriptions-item>
      <el-descriptions-item label="操作时间">
        <template #default> {{ proxy.parseTime(info.operTime) }}</template>
      </el-descriptions-item>
      <el-descriptions-item v-if="info.status === 1" label="异常信息">
        <template #default>
          <span class="text-danger"> {{ info.errorMsg }}</span>
        </template>
      </el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import type { OperLogForm } from '@/api/monitor/operlog/types';

const open = ref(false);
const info = ref<OperLogForm | null>(null);
function openDialog(row: OperLogForm) {
  info.value = row;
  open.value = true;
}

function closeDialog() {
  open.value = false;
}

defineExpose({
  openDialog,
  closeDialog
});

/**
 * 字典信息
 */
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_oper_type } = toRefs<any>(proxy?.useDict('sys_oper_type'));
const typeFormat = (row: OperLogForm) => {
  return proxy?.selectDictLabel(sys_oper_type.value, row.businessType);
};
const operationLabel = (row: OperLogForm) => {
  return row.operationName || typeFormat(row);
};
</script>

<style lang="scss" scoped>
/**
label宽度固定
*/
:deep(.el-descriptions__label) {
  min-width: 100px;
}
/**
文字超过 换行显示
*/
:deep(.el-descriptions__content) {
  max-width: 300px;
}
</style>
