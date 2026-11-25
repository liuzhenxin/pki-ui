<template>
  <span class="cert-row-action">
    <el-tooltip :content="label" placement="top">
      <span class="cert-row-action-trigger">
        <el-dropdown v-if="$slots.dropdown" trigger="click" :disabled="disabled" @command="onCommand">
          <el-button link :type="type" :icon="icon" :aria-label="label" :disabled="disabled" />
          <template #dropdown><slot name="dropdown" /></template>
        </el-dropdown>
        <el-button v-else link :type="type" :icon="icon" :aria-label="label" :disabled="disabled" :loading="loading" @click="emit('click', $event)" />
      </span>
    </el-tooltip>
  </span>
</template>

<script setup lang="ts">
import type { ButtonProps } from 'element-plus';

withDefaults(defineProps<{
  label: string;
  icon: string;
  type?: ButtonProps['type'];
  disabled?: boolean;
  loading?: boolean;
}>(), { type: 'primary' });

const emit = defineEmits<{ click: [event: MouseEvent]; command: [value: string] }>();

function onCommand(value: unknown) {
  if (typeof value === 'string') emit('command', value);
}
</script>

<style scoped>
.cert-row-action {
  display: inline-flex;
  margin-inline: 2px;
  vertical-align: middle;
}

.cert-row-action-trigger {
  display: inline-flex;
  justify-content: center;
  width: 28px;
  height: 28px;
}

.cert-row-action-trigger :deep(.el-button) {
  width: 28px;
  height: 28px;
  margin: 0;
}
</style>
