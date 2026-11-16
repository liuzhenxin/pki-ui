<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="min(720px, 96vw)"
    append-to-body
    destroy-on-close
    :show-close="!busy"
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
  >
    <el-form label-width="110px" :disabled="busy">
      <template v-if="bindingRootId == null">
        <el-form-item label="CA 名称" required>
          <el-input v-model="name" maxlength="100" placeholder="输入管理名称" />
        </el-form-item>
        <el-form-item v-if="subordinate" label="父 CA" required>
          <el-select v-model="parentRootId" filterable style="width: 100%" placeholder="选择已登记的直接颁发者" @change="clearPreview">
            <el-option v-for="root in parents" :key="root.id" :label="root.name" :value="root.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="CA 证书" required>
          <input type="file" aria-label="选择 CA 证书" accept=".cer,.crt,.pem,.der" :disabled="busy" @change="selectFile" />
        </el-form-item>
      </template>
      <template v-if="preview">
        <el-descriptions :column="1" border class="mb-4">
          <el-descriptions-item label="主题">{{ preview.certificate.subject }}</el-descriptions-item>
          <el-descriptions-item label="颁发者">{{ preview.certificate.issuer }}</el-descriptions-item>
          <el-descriptions-item label="序列号">{{ preview.certificate.serialNumber }}</el-descriptions-item>
          <el-descriptions-item label="有效期"
            >{{ parseTime(preview.certificate.notBefore) }} 至 {{ parseTime(preview.certificate.notAfter) }}</el-descriptions-item
          >
          <el-descriptions-item label="签名算法">{{ preview.certificate.signatureAlgorithm }}</el-descriptions-item>
          <el-descriptions-item label="SHA-256 指纹">
            <span class="break-all">{{ preview.certificate.sha256 }}</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="preview.parent" label="父 CA 指纹">
            <span class="break-all">{{ preview.parent.sha256 }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-alert v-if="preview.existingRootId != null" title="此证书已登记" type="info" :closable="false" />
      </template>
      <el-form-item v-if="bindingRootId != null || (preview && preview.existingRootId == null)" label="签名者" :required="bindingRootId != null">
        <el-select
          v-model="signerId"
          clearable
          :value-on-clear="null"
          filterable
          style="width: 100%"
          :placeholder="bindingRootId == null ? '可留空，稍后绑定' : '选择签名者'"
        >
          <el-option
            v-for="signer in signers"
            :key="signer.id"
            :label="signerLabel(signer)"
            :value="signer.id"
            :disabled="publicKeyStatus(signer) === 'MISMATCH'"
          />
        </el-select>
        <div v-if="!signers.length" class="mt-1 text-sm">请先在签名者管理中配置 PKCS12 或 SDF 签发者。</div>
        <div v-else-if="selectedSigner && publicKeyStatus(selectedSigner) === 'UNVERIFIED'" class="mt-1 text-sm">
          暂未读取到签名公钥，保存时将用原 CA 证书验证签名。
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="busy" @click="visible = false">取消</el-button>
      <el-button v-if="bindingRootId != null" type="primary" :loading="busy" :disabled="signerId == null" @click="saveBinding">
        验证并绑定
      </el-button>
      <el-button v-else-if="preview?.existingRootId != null" type="primary" @click="complete(preview.existingRootId)">查看已有记录</el-button>
      <el-button v-else-if="preview" type="primary" :loading="busy" :disabled="!name.trim()" @click="saveImport">确认导入</el-button>
      <el-button v-else type="primary" :loading="busy" :disabled="!file || (subordinate && parentRootId == null)" @click="loadPreview">
        预览证书
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { bindExistingCaSigner, getExistingCaSigners, importExistingCa, previewExistingCa } from '@/api/ca/root';
import type { ExistingCaPreview, ExistingCaSigner, RootHierarchyEntry } from '@/api/ca/root';
import { parseTime } from '@/utils/ruoyi';

defineProps<{ parents: RootHierarchyEntry[] }>();
const emit = defineEmits<{ completed: [id: string | number] }>();

const visible = ref(false);
const busy = ref(false);
const subordinate = ref(false);
const bindingRootId = ref<string | number>();
const bindingRootName = ref('');
const parentRootId = ref<string | number>();
const signerId = ref<string | number | null>();
const name = ref('');
const file = ref<File>();
const encoded = ref('');
const preview = ref<ExistingCaPreview>();
const signers = ref<ExistingCaSigner[]>([]);
const selectedSigner = computed(() => signers.value.find((signer) => signer.id === signerId.value));
const title = computed(() =>
  bindingRootId.value != null ? `绑定签名者 · ${bindingRootName.value}` : subordinate.value ? '导入已有子 CA' : '导入已有根 CA'
);

function clearPreview() {
  preview.value = undefined;
  signerId.value = undefined;
  signers.value = [];
}

function openImport(isSubordinate: boolean) {
  bindingRootId.value = undefined;
  subordinate.value = isSubordinate;
  parentRootId.value = undefined;
  name.value = '';
  file.value = undefined;
  encoded.value = '';
  clearPreview();
  visible.value = true;
}

function applySignerOptions(options: ExistingCaSigner[]) {
  signers.value = options;
  const matches = options.filter((option) => publicKeyStatus(option) === 'MATCH');
  signerId.value = matches.length === 1 ? matches[0].id : undefined;
}

function publicKeyStatus(signer: ExistingCaSigner) {
  return signer.publicKeyStatus ?? (signer.matching ? 'MATCH' : 'UNVERIFIED');
}

function signerLabel(signer: ExistingCaSigner) {
  const statusLabel = { MATCH: '公钥匹配', MISMATCH: '公钥不匹配', UNVERIFIED: '待验证' };
  const index = signer.type.toUpperCase() === 'SDF' && signer.keyIndex != null ? ` · 索引 ${signer.keyIndex}` : '';
  return `${signer.name}（${signer.type}${index} · ${statusLabel[publicKeyStatus(signer)]}）`;
}

async function openBinding(root: RootHierarchyEntry) {
  clearPreview();
  bindingRootId.value = root.id;
  bindingRootName.value = root.name;
  visible.value = true;
  busy.value = true;
  try {
    const { data } = await getExistingCaSigners(root.id);
    applySignerOptions(data || []);
  } catch {
    // The request interceptor reports the server error.
  } finally {
    busy.value = false;
  }
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0];
  if (file.value && file.value.size > 65536) {
    ElMessage.error('证书文件不能超过 64 KB');
    input.value = '';
    file.value = undefined;
  }
  if (!name.value && file.value) {
    name.value = file.value.name.replace(/(\.(pem|cer|crt|der))+$/i, '').slice(0, 100);
  }
  encoded.value = '';
  clearPreview();
}

function command() {
  return {
    name: name.value.trim(),
    certificate: encoded.value,
    subordinate: subordinate.value,
    parentRootId: parentRootId.value,
    signerId: signerId.value ?? undefined
  };
}

async function loadPreview() {
  if (!file.value) return;
  busy.value = true;
  try {
    const bytes = new Uint8Array(await file.value.arrayBuffer());
    encoded.value = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
    const { data } = await previewExistingCa(command());
    preview.value = data;
    applySignerOptions(data.signers);
  } catch {
    if (!encoded.value) ElMessage.error('无法读取证书文件，请重新选择');
  } finally {
    busy.value = false;
  }
}

async function saveImport() {
  busy.value = true;
  try {
    const { data } = await importExistingCa(command());
    ElMessage.success('CA 证书已登记');
    complete(data);
  } catch {
    // The request interceptor reports the server error.
  } finally {
    busy.value = false;
  }
}

async function saveBinding() {
  if (bindingRootId.value == null || signerId.value == null) return;
  busy.value = true;
  try {
    await bindExistingCaSigner(bindingRootId.value, signerId.value);
    ElMessage.success('签名者验证通过，已绑定');
    complete(bindingRootId.value);
  } catch {
    // The request interceptor reports the server error.
  } finally {
    busy.value = false;
  }
}

function complete(id: string | number) {
  visible.value = false;
  emit('completed', id);
}

defineExpose({ openImport, openBinding });
</script>
