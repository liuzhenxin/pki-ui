<template>
  <div class="ops-page">
    <el-card shadow="never" class="ops-panel">
      <template #header>
        <div class="ops-panel-header">
          <div>
            <span>运维审计</span>
            <small>容器启停、探针重试和采集刷新等操作记录</small>
          </div>
          <el-button icon="Refresh" disabled>刷新</el-button>
        </div>
      </template>

      <el-table :data="[]" border>
        <el-table-column label="操作编号" prop="operationNo" min-width="150" />
        <el-table-column label="操作类型" prop="operationType" min-width="140" />
        <el-table-column label="目标服务器" prop="serverCode" min-width="150" />
        <el-table-column label="目标容器" prop="containerName" min-width="160" />
        <el-table-column label="结果" prop="result" width="100" align="center" />
        <el-table-column label="操作人" prop="operatorName" width="120" align="center" />
        <el-table-column label="操作时间" prop="createTime" width="180" align="center" />
      </el-table>

      <el-empty description="暂无运维审计记录" />
    </el-card>
  </div>
</template>

<script setup name="OpsAudit" lang="ts"></script>

<style scoped lang="scss">
.ops-page {
  padding: 12px;
}

.ops-panel {
  border-radius: 8px;
}

.ops-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span,
  small {
    display: block;
  }

  span {
    color: #1f2937;
    font-weight: 600;
  }

  small {
    margin-top: 4px;
    color: #6b7280;
    font-size: 12px;
    font-weight: 400;
  }
}
</style>
