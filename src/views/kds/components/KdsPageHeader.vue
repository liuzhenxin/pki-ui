<template>
  <header class="kds-page-header">
    <div class="kds-page-header__copy">
      <p class="kds-page-header__eyebrow">密钥分发与终端接入系统</p>
      <h1>{{ title }}</h1>
      <p class="kds-page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="kds-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>
