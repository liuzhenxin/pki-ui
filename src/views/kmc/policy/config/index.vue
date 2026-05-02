<template>
  <div class="p-2">
    <el-card shadow="never">
      <el-alert
        title="当前 KMC 后端暂未提供独立策略配置接口，请在密钥池策略、CA 配置、水位管理页面维护可执行配置。"
        type="info"
        :closable="false"
        show-icon
      />
    </el-card>
  </div>
</template>

<script setup name="KmcPolicyConfig" lang="ts"></script>

