<!-- 纯布局骨架：平台与产品共用；不读取用户、令牌或初始化状态。 -->
<script setup lang="ts">
defineProps<{ hasTagsView?: boolean; sidebarHidden?: boolean }>();
</script>
<template>
  <div class="app-wrapper">
    <slot name="navigation" />
    <div class="main-container" :class="{ hasTagsView, sidebarHide: sidebarHidden }">
      <slot name="header" />
      <slot />
    </div>
  </div>
</template>
