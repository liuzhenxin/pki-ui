<template>
  <div class="agreement-content">
    <p>版权所有（C ）2025 {{ companyName || '北京国富安电子商务安全认证有限公司' }}</p>
    <p><strong>导言</strong></p>
    <p>
      <span v-if="tenantName">系统名称: {{ tenantName }}</span>
      <span v-if="tenantCode"> ( {{ tenantCode.toUpperCase() }} )</span>，系{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}独立开发软件，{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}依法独立享有该软件之所有权利，此软件为商业软件提供付费使用。
    </p>
    <p>
      该软件使用者（含个人、法人或其它组织）：的一般性、特殊性、意外性或间接性损失，不负任何责任（包括但不限于，资料损失，资料执行不精确，或
      应由您或第三人承担的损失，或本程序无法与其他程序运作等），即便该版权所有者或其他组织已经被告知程序有此类损失的可能性也是如此。
    </p>
    <p>
      非经{{ companyName || '北京国富安电子商务安全认证有限公司' }}授权许可，不得将之用于盈利或非盈利性的任何用途。
    </p>
    <p>
      为适应实际的计算机应用环境，对其功能、性能、界面，可以进行必要的修改，但不得去除{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}的版本标示；未经{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}书面授权许可，不得向任何第三方提供修改后的软件。
    </p>
    <p>
      使用该软件必须保留{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}的版权声明，将该软件从原有自然语言文字转换成另一自然语言文字的，仍应注明出处，并不得向任何第三方提供修改后的软件。
    </p>
    <p>不得有其他侵犯{{ companyName || '北京国富安电子商务安全认证有限公司' }}软件版权之行为。</p>
    <p>
      凡有上述侵权行为的个人、法人或其它组织，必须立即停止侵权并对其侵权造成的一切不良后果承担全部责任。对此前，尤其是此后侵犯{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}版权的行为，{{
        companyName || '北京国富安电子商务安全认证有限公司'
      }}将依据《著作权法》、《计算机软件保护条例》等相关法律、法规追究其经济责任和法律责任。
    </p>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

defineProps({
  tenantCode: {
    type: String,
    default: ''
  },
  tenantName: {
    type: String,
    default: ''
  },
  companyName: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.agreement-content {
  line-height: 1.6;
}
p {
  margin-bottom: 10px;
}
</style>
