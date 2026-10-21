import { createApp, defineComponent, h } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import UserManagement from '../../../src/components/ApplicationUserManagement/index.vue';
import UserEntry from '../../../src/components/ApplicationUserManagement/ApplicationUserEntry.vue';
import RoleManagement from '../../../src/components/ApplicationRoleManagement/index.vue';
import Installation from '../../../src/components/ApplicationInstallation/index.vue';
import CaAuditEntry from '../../../src/views/ca/audit/index.vue';
import KmcAuditEntry from '../../../src/views/kmc/audit/index.vue';
const Legacy = defineComponent({ render: () => h('p', 'LEGACY_ONLY') });
const surface = new URLSearchParams(location.search).get('surface');
const app = createApp(
  defineComponent({
    render: () =>
      surface === 'ca-audit'
        ? h(CaAuditEntry)
        : surface === 'kmc-audit'
          ? h(KmcAuditEntry)
          : surface === 'role'
            ? h(RoleManagement)
            : surface === 'installation'
              ? h(Installation)
              : surface === 'entry'
                ? h(UserEntry, { legacyComponent: Legacy })
                : h(UserManagement)
  })
);
app.use(ElementPlus);
app.component(
  'Pagination',
  defineComponent({
    props: ['total'],
    render() {
      return h('span', { 'data-testid': 'pagination' }, '总数 ' + this.total);
    }
  })
);
app.mount('#app');
