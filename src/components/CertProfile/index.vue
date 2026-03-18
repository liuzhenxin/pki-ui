<template>
  <div class="cert-profile-detail">
    <el-descriptions title="基本信息" :column="2" border>
      <template #title>
        <div class="section-title">
          <el-icon><InfoFilled /></el-icon>
          <span>基本信息</span>
        </div>
      </template>
      <el-descriptions-item label="类别">{{ profile.metadata?.category }}</el-descriptions-item>
      <el-descriptions-item label="详情">{{ profile.metadata?.details }}</el-descriptions-item>
      <el-descriptions-item label="有效期">{{ profile.validity }}</el-descriptions-item>
      <el-descriptions-item label="生效时间">{{ profile.notBeforeTime }}</el-descriptions-item>
      <el-descriptions-item label="密钥算法">
        <el-tag v-for="algo in profile.keyAlgorithms" :key="algo" class="mr-1" effect="plain">{{ algo }}</el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <el-tabs type="border-card" style="margin-top: 20px;">
      <el-tab-pane>
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><User /></el-icon>
            <span>主体信息 (Subject)</span>
          </span>
        </template>
        <el-table :data="profile.subject" border style="width: 100%" size="small" :header-cell-style="{ background: '#f5f7fa', color: '#606266' }">
          <el-table-column prop="type" label="类型">
            <template #default="{ row }">
              <span class="type-label">{{ getSubjectTypeLabel(row.type) }}</span>
              <span class="type-code">({{ row.type }})</span>
            </template>
          </el-table-column>
          <el-table-column prop="minOccurs" label="最小出现次数" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.minOccurs === 0 ? 'info' : ''">{{ row.minOccurs !== undefined ? row.minOccurs : '1' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane>
        <template #label>
          <span class="custom-tabs-label">
            <el-icon><Connection /></el-icon>
            <span>扩展信息 (Extensions)</span>
          </span>
        </template>
        <el-collapse v-if="profile.extensions && profile.extensions.length > 0">
          <el-collapse-item v-for="(ext, index) in profile.extensions" :key="index">
            <template #title>
              <div class="extension-header">
                <span class="extension-title">{{ getExtensionTypeLabel(ext.type) }}</span>
                <span class="extension-code">({{ ext.type }})</span>
                <el-tag v-if="ext.required" type="danger" size="small" effect="dark" class="ml-2">必须</el-tag>
              </div>
            </template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="类型">{{ getExtensionTypeLabel(ext.type) }} ({{ ext.type }})</el-descriptions-item>
              <el-descriptions-item label="必须">
                <el-tag :type="ext.required ? 'danger' : 'info'" size="small">{{ ext.required ? '是' : '否' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item v-if="ext.critical !== undefined" label="关键">
                <el-tag :type="ext.critical ? 'warning' : 'info'" size="small">{{ ext.critical ? '是' : '否' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item v-if="ext.inRequest" label="请求中包含">{{ ext.inRequest }}</el-descriptions-item>

              <el-descriptions-item v-if="ext.keyUsage" label="密钥用法">
                <div v-for="(usageGroup, uIndex) in ext.keyUsage.usages" :key="uIndex">
                  <el-tag v-for="u in usageGroup.required" :key="u" type="success" class="mr-1" size="small">{{ u }}</el-tag>
                </div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.extendedKeyUsage" label="增强密钥用法">
                 <el-tag v-for="u in ext.extendedKeyUsage.required" :key="u" type="success" class="mr-1" size="small">{{ u }}</el-tag>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.authorityInfoAccess" label="授权信息访问">
                <div v-if="ext.authorityInfoAccess.includeCaIssuers">包含 CA 发行者</div>
                <div v-if="ext.authorityInfoAccess.includeOcsp">包含 OCSP</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.basicConstraints" label="基本约束">
                 CA: {{ ext.basicConstraints.ca ? '是' : '否' }}
                 <span v-if="ext.basicConstraints.pathLenConstraint !== undefined">, 路径长度: {{ ext.basicConstraints.pathLenConstraint }}</span>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.subjectAlternativeName" label="主体备用名称">
                <el-tag v-for="(name, sIndex) in ext.subjectAlternativeName.names" :key="sIndex" class="mr-1" size="small">{{ name.type }}: {{ name.value }}</el-tag>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.cRLDistributionPoints" label="CRL分发点">
                <div v-for="(point, cIndex) in ext.cRLDistributionPoints.points" :key="cIndex">{{ point }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.authorityKeyIdentifier" label="颁发机构密钥标识符">
                {{ ext.authorityKeyIdentifier.keyIdentifier }}
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.subjectKeyIdentifier" label="主体密钥标识符">
                {{ ext.subjectKeyIdentifier.keyIdentifier }}
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.issuerAlternativeName" label="颁发者备用名称">
                <el-tag v-for="(name, iIndex) in ext.issuerAlternativeName.names" :key="iIndex" class="mr-1" size="small">{{ name.type }}: {{ name.value }}</el-tag>
              </el-descriptions-item>
            <el-descriptions-item v-if="ext.certificatePolicies" label="证书策略">
              <div v-for="(policy, pIndex) in ext.certificatePolicies.policies" :key="pIndex">{{ policy.policyIdentifier }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.policyConstraints" label="策略约束">
                <div v-if="ext.policyConstraints.requireExplicitPolicy !== undefined">要求显式策略: {{ ext.policyConstraints.requireExplicitPolicy }}</div>
                <div v-if="ext.policyConstraints.inhibitPolicyMapping !== undefined">禁止策略映射: {{ ext.policyConstraints.inhibitPolicyMapping }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.policyMappings" label="策略映射">
                <div v-for="(mapping, mIndex) in ext.policyMappings.mappings" :key="mIndex">{{ mapping.issuerDomainPolicy }}: {{ mapping.subjectDomainPolicy }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.nameConstraints" label="名称约束">
                <div v-if="ext.nameConstraints.permittedSubtrees">允许子树: {{ ext.nameConstraints.permittedSubtrees.join(', ') }}</div>
                <div v-if="ext.nameConstraints.excludedSubtrees">排除子树: {{ ext.nameConstraints.excludedSubtrees.join(', ') }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.inhibitAnyPolicy" label="禁止任意策略">
                {{ ext.inhibitAnyPolicy.skipCerts }}
              </el-descriptions-item>

            </el-descriptions>
          </el-collapse-item>
        </el-collapse>
        <el-empty v-else description="无扩展信息" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { InfoFilled, User, Connection } from '@element-plus/icons-vue';

defineProps({
  profile: {
    type: Object as PropType<any>,
    required: true,
    default: () => ({})
  }
});

const subjectTypeMap: Record<string, string> = {
  country: '国家 (C)',
  organization: '组织 (O)',
  organizationalUnit: '组织单位 (OU)',
  commonName: '通用名称 (CN)',
  serialNumber: '序列号 (SN)',
  locality: '地区 (L)',
  stateOrProvince: '省/州 (ST)',
  domainComponent: '域名组件 (DC)',
  emailAddress: '电子邮件 (E)',
  organizationIdentifier: '组织标识符'
};

const getSubjectTypeLabel = (type: string) => {
  return subjectTypeMap[type] || type;
};

const extensionTypeMap: Record<string, string> = {
  SubjectKeyIdentifier: '主体密钥标识符',
  KeyUsage: '密钥用法',
  ExtendedKeyUsage: '增强密钥用法',
  BasicConstraints: '基本约束',
  AuthorityInfoAccess: '授权信息访问',
  AuthorityKeyIdentifier: '颁发机构密钥标识符',
  CRLDistributionPoints: 'CRL分发点',
  FreshestCRL: '最新CRL',
  OCSPNoCheck: 'OCSP无检查',
  SubjectAlternativeName: '主体备用名称',
  IssuerAlternativeName: '颁发者备用名称',
  CertificatePolicies: '证书策略',
  PolicyMappings: '策略映射',
  PolicyConstraints: '策略约束',
  NameConstraints: '名称约束',
  InhibitAnyPolicy: '禁止任意策略'
};

const getExtensionTypeLabel = (type: string) => {
  return extensionTypeMap[type] || type;
};
</script>

<style scoped lang="scss">
.cert-profile-detail {
  padding: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #303133;

  .el-icon {
    margin-right: 8px;
    color: #409eff;
  }
}

.custom-tabs-label {
  display: flex;
  align-items: center;

  .el-icon {
    margin-right: 5px;
  }
}

.mr-1 {
  margin-right: 5px;
  margin-bottom: 5px;
}

.ml-2 {
  margin-left: 10px;
}

.type-label {
  font-weight: 500;
  color: #303133;
}

.type-code {
  color: #909399;
  font-size: 12px;
  margin-left: 5px;
}

.extension-header {
  display: flex;
  align-items: center;
  width: 100%;
}

.extension-title {
  font-weight: 600;
  color: #303133;
}

.extension-code {
  color: #909399;
  font-size: 13px;
  margin-left: 8px;
}

:deep(.el-collapse-item__header) {
  background-color: #fcfcfc;
  padding-left: 10px;
  border-bottom: 1px solid #ebeef5;

  &.is-active {
    border-bottom-color: transparent;
  }
}

:deep(.el-descriptions__label) {
  font-weight: 500;
  color: #606266;
  background-color: #f5f7fa;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 0;
}
</style>
