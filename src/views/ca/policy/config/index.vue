<template>
  <div class="app-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>策略配置</span>
        </div>
      </template>
      <el-tabs v-model="activeTab">
        <!-- 协议配置 -->
        <el-tab-pane label="协议配置" name="protocol">
          <el-form :model="protocolForm" label-width="120px">
            <el-divider content-position="left">CMP 协议</el-divider>
            <el-form-item label="启用 CMP">
              <el-switch v-model="protocolForm.cmpEnabled" />
            </el-form-item>
            <el-form-item label="CMP 端口" v-if="protocolForm.cmpEnabled">
              <el-input-number v-model="protocolForm.cmpPort" :min="1" :max="65535" />
            </el-form-item>

            <el-divider content-position="left">ACME 协议</el-divider>
            <el-form-item label="启用 ACME">
              <el-switch v-model="protocolForm.acmeEnabled" />
            </el-form-item>
            <el-form-item label="ACME 目录 URL" v-if="protocolForm.acmeEnabled">
              <el-input v-model="protocolForm.acmeUrl" placeholder="https://ca.example.com/acme/directory" />
            </el-form-item>

            <el-divider content-position="left">RESTful API</el-divider>
            <el-form-item label="启用 API">
              <el-switch v-model="protocolForm.apiEnabled" />
            </el-form-item>
            <el-form-item label="API 认证方式" v-if="protocolForm.apiEnabled">
              <el-select v-model="protocolForm.apiAuthType">
                <el-option label="Token" value="token" />
                <el-option label="Basic Auth" value="basic" />
                <el-option label="Client Cert" value="cert" />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveProtocol">保存协议配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 发布配置 -->
        <el-tab-pane label="发布配置" name="publish">
          <el-form :model="publishForm" label-width="140px">
            <el-divider content-position="left">CRL 发布</el-divider>
            <el-form-item label="发布周期">
              <el-input-number v-model="publishForm.crlInterval" :min="1" />
              <el-select v-model="publishForm.crlUnit" style="width: 100px; margin-left: 10px">
                <el-option label="小时" value="hour" />
                <el-option label="天" value="day" />
              </el-select>
            </el-form-item>
            <el-form-item label="下次发布时间">
              <el-date-picker v-model="publishForm.nextCrlUpdate" type="datetime" placeholder="选择日期时间" />
            </el-form-item>

            <el-divider content-position="left">LDAP 发布</el-divider>
            <el-form-item label="启用 LDAP">
              <el-switch v-model="publishForm.ldapEnabled" />
            </el-form-item>
            <template v-if="publishForm.ldapEnabled">
              <el-form-item label="服务器地址">
                <el-input v-model="publishForm.ldapHost" placeholder="ldap://localhost:389" />
              </el-form-item>
              <el-form-item label="Base DN">
                <el-input v-model="publishForm.ldapBaseDn" placeholder="dc=example,dc=com" />
              </el-form-item>
              <el-form-item label="绑定用户">
                <el-input v-model="publishForm.ldapBindDn" placeholder="cn=admin,dc=example,dc=com" />
              </el-form-item>
              <el-form-item label="绑定密码">
                <el-input v-model="publishForm.ldapPassword" type="password" show-password />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button type="primary" @click="savePublish">保存发布配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 归档配置 -->
        <el-tab-pane label="归档配置" name="archive">
          <el-form :model="archiveForm" label-width="120px">
            <el-form-item label="启用自动归档">
              <el-switch v-model="archiveForm.enabled" />
            </el-form-item>
            <el-form-item label="归档周期" v-if="archiveForm.enabled">
              <el-input-number v-model="archiveForm.interval" :min="1" />
              <el-select v-model="archiveForm.unit" style="width: 100px; margin-left: 10px">
                <el-option label="天" value="day" />
                <el-option label="月" value="month" />
                <el-option label="年" value="year" />
              </el-select>
            </el-form-item>
            <el-form-item label="保留策略" v-if="archiveForm.enabled">
              <el-radio-group v-model="archiveForm.policy">
                <el-radio label="keep">永久保留</el-radio>
                <el-radio label="delete">过期后删除</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="保留时长" v-if="archiveForm.enabled && archiveForm.policy === 'delete'">
              <el-input-number v-model="archiveForm.retentionTime" :min="1" />
              <span style="margin-left: 10px">年</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveArchive">保存归档配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 安全配置 -->
        <el-tab-pane label="安全配置" name="security">
          <el-form :model="securityForm" label-width="120px">
            <el-divider content-position="left">白名单配置</el-divider>
            <el-form-item label="启用白名单">
              <el-switch v-model="securityForm.whitelistEnabled" />
            </el-form-item>
            <el-form-item label="IP 白名单" v-if="securityForm.whitelistEnabled">
              <el-input
                v-model="securityForm.whitelistIps"
                type="textarea"
                :rows="5"
                placeholder="请输入允许访问的IP地址，每行一个。支持CIDR格式 (e.g., 192.168.1.0/24)"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveSecurity">保存安全配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

const activeTab = ref('protocol');

// 协议配置数据
const protocolForm = reactive({
  cmpEnabled: false,
  cmpPort: 8080,
  acmeEnabled: false,
  acmeUrl: '',
  apiEnabled: true,
  apiAuthType: 'token'
});

// 发布配置数据
const publishForm = reactive({
  crlInterval: 24,
  crlUnit: 'hour',
  nextCrlUpdate: '',
  ldapEnabled: false,
  ldapHost: '',
  ldapBaseDn: '',
  ldapBindDn: '',
  ldapPassword: ''
});

// 归档配置数据
const archiveForm = reactive({
  enabled: true,
  interval: 1,
  unit: 'month',
  policy: 'keep',
  retentionTime: 5
});

// 安全配置数据
const securityForm = reactive({
  whitelistEnabled: false,
  whitelistIps: ''
});

// 保存方法 (模拟)
const saveProtocol = () => {
  console.log('Protocol Config:', protocolForm);
  ElMessage.success('协议配置已保存');
};

const savePublish = () => {
  console.log('Publish Config:', publishForm);
  ElMessage.success('发布配置已保存');
};

const saveArchive = () => {
  console.log('Archive Config:', archiveForm);
  ElMessage.success('归档配置已保存');
};

const saveSecurity = () => {
  console.log('Security Config:', securityForm);
  ElMessage.success('安全配置已保存');
};
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
