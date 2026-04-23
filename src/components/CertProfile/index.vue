<template>
  <div class="cert-profile-detail">
    <el-descriptions title="基本信息" :column="2" border>
      <template #title>
        <div class="section-title">
          <el-icon><InfoFilled /></el-icon>
          <span>基本信息</span>
        </div>
      </template>
      <el-descriptions-item label="类别">{{ profile.metadata?.category || '-' }}</el-descriptions-item>
      <el-descriptions-item label="详情">{{ profile.metadata?.details || '-' }}</el-descriptions-item>
      <el-descriptions-item label="证书层级">{{ profile.certLevel || '-' }}</el-descriptions-item>
      <el-descriptions-item label="最大大小">{{ profile.maxSize || '-' }}</el-descriptions-item>
      <el-descriptions-item label="有效期">{{ profile.validity || '-' }}</el-descriptions-item>
      <el-descriptions-item label="生效时间">{{ profile.notBeforeTime || '-' }}</el-descriptions-item>
      <el-descriptions-item label="密钥算法" :span="2">
        <el-tag v-for="algo in parsedKeyAlgorithms" :key="algo" class="mr-1" type="info" effect="plain">
          {{ algo }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="签名算法" :span="2">
        <el-tag v-for="algo in (profile.signatureAlgorithms || [])" :key="algo" class="mr-1" type="success" effect="plain">
          {{ algo }}
        </el-tag>
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
        <el-table :data="subjectData" border style="width: 100%" size="small" :header-cell-style="{ background: '#f5f7fa', color: '#606266' }">
          <el-table-column prop="type" label="类型" min-width="150">
            <template #default="{ row }">
              <span class="type-label">{{ getSubjectTypeLabel(row.type) }}</span>
              <span class="type-code" v-if="typeof row.type === 'object' && row.type.oid"> ({{ row.type.oid }})</span>
            </template>
          </el-table-column>
          <el-table-column prop="minOccurs" label="最小出现次数" align="center" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="Number(row.minOccurs) === 0 ? 'info' : 'primary'">
                {{ row.minOccurs !== undefined ? row.minOccurs : '1' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="maxOccurs" label="最大出现次数" align="center" width="120">
            <template #default="{ row }">
              <span v-if="row.maxOccurs">{{ row.maxOccurs }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="regex" label="正则表达式">
            <template #default="{ row }">
              <code v-if="row.regex">{{ row.regex }}</code>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="profile.subjectToSubjectAltNames && profile.subjectToSubjectAltNames.length > 0" style="margin-top: 20px">
          <div class="sub-section-title">主题到备用名称映射 (Subject to SAN Mapping)</div>
          <el-table :data="profile.subjectToSubjectAltNames" border size="small">
            <el-table-column label="源字段">
              <template #default="{ row }">
                {{ getSubjectTypeLabel(row.source) }} ({{ getTypeLabel(row.source) }})
              </template>
            </el-table-column>
            <el-table-column prop="target" label="目标类型" />
          </el-table>
        </div>
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
                <span class="extension-code">({{ getTypeLabel(ext.type) }})</span>
                <el-tag v-if="ext.required" type="danger" size="small" effect="dark" class="ml-2">必须</el-tag>
              </div>
            </template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="类型">{{ getExtensionTypeLabel(ext.type) }} ({{ getTypeLabel(ext.type) }})</el-descriptions-item>
              <el-descriptions-item label="必须">
                <el-tag :type="ext.required ? 'danger' : 'info'" size="small">{{ ext.required ? '是' : '否' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item v-if="ext.critical !== undefined" label="关键">
                <el-tag :type="ext.critical ? 'warning' : 'info'" size="small">{{ ext.critical ? '是' : '否' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item v-if="ext.inRequest" label="请求中包含">{{ ext.inRequest }}</el-descriptions-item>

              <el-descriptions-item v-if="ext.keyUsage" label="密钥用法">
                <div v-if="ext.keyUsage.usages">
                  <div v-for="(u, uIdx) in ext.keyUsage.usages" :key="uIdx" class="mb-1">
                    <el-tag :type="u.required === true || String(u.required) === 'true' ? 'success' : 'info'" size="small">{{ u.value }}</el-tag>
                    <span class="ml-1 text-xs text-gray-400" v-if="u.required === true || String(u.required) === 'true'">(必须)</span>
                  </div>
                </div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.extendedKeyUsage" label="增强密钥用法">
                 <div v-if="ext.extendedKeyUsage.usages">
                    <div v-for="(u, uIdx) in ext.extendedKeyUsage.usages" :key="uIdx" class="mb-1">
                      <el-tag :type="u.required === true || String(u.required) === 'true' ? 'success' : 'info'" size="small">{{ u.description || u.oid }}</el-tag>
                      <span class="ml-1 text-xs text-gray-400">({{ u.oid }})</span>
                      <span class="ml-1 text-xs text-gray-400" v-if="u.required === true || String(u.required) === 'true'">(必须)</span>
                    </div>
                 </div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.authorityInfoAccess" label="授权信息访问">
                <div v-if="ext.authorityInfoAccess.includeCaIssuers">包含 CA 发行者</div>
                <div v-if="ext.authorityInfoAccess.includeOcsp">包含 OCSP</div>
                <div v-if="ext.authorityInfoAccess.caIssuersProtocols">CA Issuers 协议: {{ ext.authorityInfoAccess.caIssuersProtocols.join(', ') }}</div>
                <div v-if="ext.authorityInfoAccess.ocspProtocols">OCSP 协议: {{ ext.authorityInfoAccess.ocspProtocols.join(', ') }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.basicConstraints" label="基本约束">
                 CA: {{ ext.basicConstraints.ca ? '是' : '否' }}
                 <span v-if="ext.basicConstraints.pathLenConstraint !== undefined">, 路径长度: {{ ext.basicConstraints.pathLenConstraint }}</span>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.subjectAltName" label="主体备用名称模式">
                <el-tag v-for="mode in (ext.subjectAltName.modes || [])" :key="mode" class="mr-1" size="small" type="info">{{ mode }}</el-tag>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.tlsFeature" label="TLS Feature">
                <div v-for="feature in (ext.tlsFeature.features || [])" :key="feature.value">
                  <el-tag size="small" class="mr-1" type="primary">{{ feature.description }}</el-tag>
                  <span class="text-xs text-gray-400">({{ feature.value }})</span>
                </div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.smimeCapabilities" label="S/MIME Capabilities">
                <div v-for="(cap, cIdx) in (ext.smimeCapabilities.capabilities || [])" :key="cIdx" class="mb-1">
                  <el-tag size="small" type="primary">{{ getTypeLabel(cap.capabilityId) }}</el-tag>
                  <span class="ml-1 text-xs text-gray-400" v-if="cap.parameter">参数: {{ JSON.stringify(cap.parameter) }}</span>
                </div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.config" label="配置详情">
                <pre class="config-pre">{{ typeof ext.config === 'object' ? JSON.stringify(ext.config, null, 2) : ext.config }}</pre>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.cRLDistributionPoints" label="CRL分发点">
                <div v-for="(point, cIndex) in (ext.cRLDistributionPoints.points || [])" :key="cIndex">{{ point }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.authorityKeyIdentifier" label="颁发机构密钥标识符">
                {{ ext.authorityKeyIdentifier.keyIdentifier }}
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.subjectKeyIdentifier" label="主体密钥标识符">
                {{ ext.subjectKeyIdentifier.keyIdentifier }}
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.issuerAlternativeName" label="颁发者备用名称">
                <el-tag v-for="(name, iIndex) in (ext.issuerAlternativeName.names || [])" :key="iIndex" class="mr-1" size="small" type="info">{{ name.type }}: {{ name.value }}</el-tag>
              </el-descriptions-item>
              
              <el-descriptions-item v-if="ext.certificatePolicies" label="证书策略">
                <div v-for="(policy, pIndex) in (ext.certificatePolicies.policies || [])" :key="pIndex">{{ policy.policyIdentifier }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.policyConstraints" label="策略约束">
                <div v-if="ext.policyConstraints.requireExplicitPolicy !== undefined">要求显式策略: {{ ext.policyConstraints.requireExplicitPolicy }}</div>
                <div v-if="ext.policyConstraints.inhibitPolicyMapping !== undefined">禁止策略映射: {{ ext.policyConstraints.inhibitPolicyMapping }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.policyMappings" label="策略映射">
                <div v-for="(mapping, mIndex) in (ext.policyMappings.mappings || [])" :key="mIndex">{{ mapping.issuerDomainPolicy }}: {{ mapping.subjectDomainPolicy }}</div>
              </el-descriptions-item>

              <el-descriptions-item v-if="ext.nameConstraints" label="名称约束">
                <div v-if="ext.nameConstraints.permittedSubtrees">允许子树: {{ (ext.nameConstraints.permittedSubtrees || []).join(', ') }}</div>
                <div v-if="ext.nameConstraints.excludedSubtrees">排除子树: {{ (ext.nameConstraints.excludedSubtrees || []).join(', ') }}</div>
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
import { PropType, computed } from 'vue';
import { InfoFilled, User, Connection } from '@element-plus/icons-vue';
import { parseKeyAlgorithms } from '@/utils/json';

const props = defineProps({
  profile: {
    type: Object as PropType<any>,
    required: true,
    default: () => ({})
  }
});

/** 解析密钥算法 */
const parsedKeyAlgorithms = computed(() => {
  return parseKeyAlgorithms(props.profile?.keyAlgorithms || []);
});

/** 处理主体数据，支持直接数组或 { rdns: [] } 结构 */
const subjectData = computed(() => {
  const s = props.profile?.subject;
  if (!s) return [];
  if (Array.isArray(s)) return s;
  if (s.rdns && Array.isArray(s.rdns)) return s.rdns;
  return [];
});

/** 获取类型标识，支持字符串或 { description: string } 对象 */
const getTypeLabel = (type: any): string => {
  if (!type) return '';
  if (typeof type === 'string') return type;
  return type.description || type.oid || '';
};

const subjectTypeMap: Record<string, string> = {
  country: '国家 (C)',
  c: '国家 (C)',
  organization: '组织 (O)',
  o: '组织 (O)',
  organizationalUnit: '组织单位 (OU)',
  ou: '组织单位 (OU)',
  commonName: '通用名称 (CN)',
  cn: '通用名称 (CN)',
  serialNumber: '序列号 (SN)',
  sn: '序列号 (SN)',
  locality: '地区 (L)',
  l: '地区 (L)',
  stateOrProvince: '省/州 (ST)',
  st: '省/州 (ST)',
  domainComponent: '域名组件 (DC)',
  dc: '域名组件 (DC)',
  emailAddress: '电子邮件 (E)',
  e: '电子邮件 (E)',
  organizationIdentifier: '组织标识符'
};

const getSubjectTypeLabel = (type: any) => {
  const label = getTypeLabel(type);
  const lowerLabel = label.toLowerCase();
  return subjectTypeMap[lowerLabel] || label;
};

const extensionTypeMap: Record<string, string> = {
  subjectkeyidentifier: '主体密钥标识符',
  keyusage: '密钥用法',
  extendedkeyusage: '增强密钥用法',
  basicconstraints: '基本约束',
  authorityinfoaccess: '授权信息访问',
  authoritykeyidentifier: '颁发机构密钥标识符',
  crldistributionpoints: 'CRL分发点',
  freshestcrl: '最新CRL',
  ocspnocheck: 'OCSP无检查',
  subjectalternativename: '主体备用名称',
  subjectaltname: '主体备用名称',
  issueralternativename: '颁发者备用名称',
  certificatepolicies: '证书策略',
  policymappings: '策略映射',
  policyconstraints: '策略约束',
  nameconstraints: '名称约束',
  inhibitanypolicy: '禁止任意策略',
  tlsfeature: 'TLS Feature',
  smimecapabilities: 'S/MIME Capabilities'
};

const getExtensionTypeLabel = (type: any) => {
  const label = getTypeLabel(type);
  const lowerLabel = label.toLowerCase();
  return extensionTypeMap[lowerLabel] || label;
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
  margin-bottom: 15px;

  .el-icon {
    margin-right: 8px;
    color: #409eff;
  }
}

.sub-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 10px;
  padding-left: 5px;
  border-left: 3px solid #409eff;
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

.config-pre {
  margin: 0;
  padding: 10px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
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

.mb-1 {
  margin-bottom: 4px;
}

.text-xs {
  font-size: 12px;
}

.text-gray-400 {
  color: #909399;
}
</style>
