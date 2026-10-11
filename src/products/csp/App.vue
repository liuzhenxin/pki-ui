<script setup lang="ts">
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>
<template>
  <ElConfigProvider :locale="zhCn"><a class="skip" href="#main">跳到主要内容</a><router-view /></ElConfigProvider>
</template>
