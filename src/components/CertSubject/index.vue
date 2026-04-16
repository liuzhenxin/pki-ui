<template>
  <div class="cert-subject-container">
    <template v-for="(item, index) in modelValue" :key="item.type + index">
      <!-- Handle standard single values -->
      <el-form-item
        :label="getFieldMeta(item.type).label"
        :prop="propPrefix ? `${propPrefix}.${index}.value` : `${index}.value`"
        :rules="getRules(item)"
      >
        <template v-if="getFieldMeta(item.type).isSelect">
          <el-select 
            v-if="item.type === 'country'" 
            v-model="item.value" 
            placeholder="请选择国家" 
            style="width: 100%"
            clearable
          >
            <el-option label="中国 (CN)" value="CN" />
            <el-option label="中国香港 (HK)" value="HK" />
            <el-option label="中国澳门 (MO)" value="MO" />
            <el-option label="中国台湾 (TW)" value="TW" />
          </el-select>
        </template>
        <template v-else>
          <el-input 
            v-model="item.value" 
            :placeholder="`请输入${getFieldMeta(item.type).label}`" 
            clearable 
          />
        </template>
      </el-form-item>
    </template>
  </div>
</template>

<script lang="ts">
export interface SubjectItem {
  type: string;
  minOccurs?: number;
  maxOccurs?: number;
  value?: string;
  regex?: string;
}

// Map x509 component types to corresponding short codes and translations
export const typeMapping: Record<string, { label: string; key: string; isSelect?: boolean }> = {
  country: { label: '国家(C)', key: 'C', isSelect: true },
  organization: { label: '组织(O)', key: 'O' },
  organizationalUnit: { label: '组织单位(OU)', key: 'OU' },
  commonName: { label: '通用名称(CN)', key: 'CN' },
  serialNumber: { label: '序列号(SN)', key: 'serialNumber' },
  locality: { label: '城市/地区(L)', key: 'L' },
  stateOrProvince: { label: '省份(ST)', key: 'ST' },
  emailAddress: { label: '邮箱(E)', key: 'E' },
  domainComponent: { label: '域名组件(DC)', key: 'DC' },
  userId: { label: '用户ID(UID)', key: 'UID' },
  title: { label: '头衔(T)', key: 'T' },
  surname: { label: '姓氏(SN)', key: 'surname' },
  givenName: { label: '名字(GN)', key: 'givenName' }
};

// Common Regex Patterns
const FQDN_REGEX = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;

// Sort weights from smallest scope to largest scope (从小到大)
const orderWeights: Record<string, number> = {
  commonName: 1,
  serialNumber: 2,
  givenName: 3,
  surname: 4,
  title: 5,
  userId: 6,
  emailAddress: 7,
  organizationalUnit: 8,
  organization: 9,
  locality: 10,
  stateOrProvince: 11,
  domainComponent: 12,
  country: 13
};

// Sorts subject items based on the predefined weights
export const sortSubjectItems = (items: SubjectItem[]) => {
  return items.sort((a, b) => {
    const wA = orderWeights[a.type] || 99;
    const wB = orderWeights[b.type] || 99;
    return wA - wB; // Smaller weight comes first (CN -> OU -> O -> C)
  });
};
</script>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: Array<SubjectItem>;
  propPrefix?: string;
}>();

console.log('CertSubject Component: modelValue', props.modelValue?.length);
const emit = defineEmits(['update:modelValue']);

const getFieldMeta = (type: string) => {
  return typeMapping[type] || { label: type, key: type.toUpperCase() };
};

const getRules = (item: SubjectItem) => {
  const rules: any[] = [];
  const meta = getFieldMeta(item.type);

  // 1. Required validation
  const isRequired = item.minOccurs === undefined || item.minOccurs > 0;
  if (isRequired) {
    rules.push({
      required: true,
      message: `请填写${meta.label}`,
      trigger: meta.isSelect ? 'change' : 'blur'
    });
  }

  // 2. Regex validation
  if (item.regex) {
    if (item.regex === ':FQDN') {
      rules.push({
        pattern: FQDN_REGEX,
        message: `${meta.label}格式不正确，应为 FQDN (如: example.com)`,
        trigger: 'blur'
      });
    } else {
      // Handle standard regex strings from profile
      try {
        // If the regex starts and ends with /, treat it as a literal regex
        const pattern = item.regex.startsWith('/') && item.regex.endsWith('/')
          ? new RegExp(item.regex.slice(1, -1))
          : new RegExp(item.regex);

        rules.push({
          pattern: pattern,
          message: `${meta.label}格式不正确 (需符合正则: ${item.regex})`,
          trigger: 'blur'
        });
      } catch (e) {
        console.warn(`Invalid regex pattern: ${item.regex}`, e);
      }
    }
  }

  return rules;
};
</script>

<style scoped>
.cert-subject-container {
  width: 100%;
}
</style>
