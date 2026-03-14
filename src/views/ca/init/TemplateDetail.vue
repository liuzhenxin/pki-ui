<template>
  <div class="template-detail">
    <el-descriptions title="基本信息" :column="2" border>
      <el-descriptions-item label="类别">{{ templateData.metadata?.category }}</el-descriptions-item>
      <el-descriptions-item label="详情">{{ templateData.metadata?.details }}</el-descriptions-item>
      <el-descriptions-item label="证书层级">{{ templateData.certLevel }}</el-descriptions-item>
      <el-descriptions-item label="最大大小">{{ templateData.maxSize }}</el-descriptions-item>
      <el-descriptions-item label="有效期">{{ templateData.validity }}</el-descriptions-item>
      <el-descriptions-item label="生效时间">{{ templateData.notBeforeTime }}</el-descriptions-item>
      <el-descriptions-item label="密钥对生成">{{ templateData.keypairGeneration }}</el-descriptions-item>
      <el-descriptions-item label="支持算法">
        <el-tag v-for="algo in templateData.keyAlgorithms" :key="algo" style="margin-right: 5px">{{ algo }}</el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">主体信息 (Subject)</el-divider>
    <el-table :data="templateData.subject" border style="width: 100%">
      <el-table-column prop="type" label="类型" />
      <el-table-column prop="minOccurs" label="最小出现次数">
        <template #default="{ row }">
          {{ row.minOccurs !== undefined ? row.minOccurs : '1' }}
        </template>
      </el-table-column>
    </el-table>

    <el-divider content-position="left">扩展信息 (Extensions)</el-divider>
    <el-collapse>
      <el-collapse-item v-for="(ext, index) in templateData.extensions" :key="index" :title="ext.type">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="类型">{{ ext.type }}</el-descriptions-item>
          <el-descriptions-item label="必须">{{ ext.required ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="关键">{{ ext.critical ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item v-if="ext.inRequest" label="请求中">{{ ext.inRequest }}</el-descriptions-item>

          <el-descriptions-item v-if="ext.authorityInfoAccess" label="AIA配置">
            <pre>{{ JSON.stringify(ext.authorityInfoAccess, null, 2) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item v-if="ext.keyUsage" label="密钥用法">
            <pre>{{ JSON.stringify(ext.keyUsage, null, 2) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item v-if="ext.extendedKeyUsage" label="增强密钥用法">
            <pre>{{ JSON.stringify(ext.extendedKeyUsage, null, 2) }}</pre>
          </el-descriptions-item>
           <!-- Add other specific extension fields as needed -->
        </el-descriptions>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps({
  templateData: {
    type: Object,
    required: true,
    default: () => ({})
  }
});
</script>

<style scoped>
.template-detail {
  padding: 10px;
}
</style>
