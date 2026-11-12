export const resourceLabels = {
  device: '密码机',
  svs: '签名验签服务器',
  tsa: '时间戳服务器',
  sef: '电子签章系统'
} as const;

export type ResourceKind = keyof typeof resourceLabels;
export type Section = 'overview' | 'applications' | ResourceKind;
export type Health = 'unchecked' | 'healthy' | 'failed';
export type Approval = 'draft' | 'pending' | 'published' | 'disabled';

export interface Resource {
  id: string;
  kind: ResourceKind;
  name: string;
  endpoint: string;
  provider: string;
  agent: string;
  pool: string;
  credentialRef: string;
  timeoutMs: number;
  enabled: boolean;
  health: Health;
  keyBindings: number;
}

export interface Application {
  id: string;
  name: string;
  clientId: string;
  owner: string;
  targets: string[];
  maxRequests: number;
  windowSeconds: number;
  approval: Approval;
}

export interface PreviewData {
  applications: Application[];
  resources: Resource[];
}

export function previewId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function newResource(kind: ResourceKind): Resource {
  return {
    id: '',
    kind,
    name: '',
    endpoint: '',
    provider: '',
    agent: '',
    pool: '',
    credentialRef: '',
    timeoutMs: 5000,
    enabled: false,
    health: 'unchecked',
    keyBindings: 0
  };
}

export function newApplication(): Application {
  return {
    id: '',
    name: '',
    clientId: '',
    owner: '',
    targets: [],
    maxRequests: 100,
    windowSeconds: 60,
    approval: 'draft'
  };
}

export function sampleData(): PreviewData {
  const hsm: Resource = {
    ...newResource('device'),
    id: 'demo-hsm',
    name: '演示密码机 A',
    provider: 'SDF 示例',
    agent: 'agent-demo',
    pool: 'pool-demo',
    endpoint: 'hsm.demo.invalid:8001',
    enabled: true,
    health: 'healthy',
    keyBindings: 2
  };
  const svs: Resource = {
    ...newResource('svs'),
    id: 'demo-svs',
    name: '演示签名验签服务器',
    provider: 'SVS 示例协议',
    endpoint: 'https://svs.demo.invalid',
    credentialRef: 'demo/svs',
    enabled: true,
    health: 'failed'
  };
  return {
    resources: [hsm, svs],
    applications: [
      {
        ...newApplication(),
        id: 'demo-application',
        name: '演示证书业务',
        clientId: 'demo-certificate-client',
        owner: '平台接入组',
        targets: [authorizationTarget(hsm), authorizationTarget(svs)],
        approval: 'published'
      },
      {
        ...newApplication(),
        id: 'demo-pending',
        name: '演示文档业务',
        clientId: 'demo-document-client',
        owner: '业务接入组',
        targets: [authorizationTarget(hsm)],
        approval: 'pending'
      }
    ]
  };
}

export function authorizationTarget(resource: Resource): string {
  return resource.kind === 'device' ? `pool:${resource.pool}` : `service:${resource.id}`;
}

export function resourceDeletionReason(resource: Resource, data: PreviewData): string | undefined {
  if (resource.enabled) return '请先停用该资源。';
  if (resource.keyBindings) return `该设备仍有 ${resource.keyBindings} 个密钥绑定。`;
  const target = authorizationTarget(resource);
  if (data.resources.some((item) => item.id !== resource.id && authorizationTarget(item) === target)) return;
  const references = data.applications.filter((app) => app.targets.includes(target));
  if (references.length) return `请先解除应用引用：${references.map((app) => app.name).join('、')}。`;
}

export function connectionError(resource: Resource): string | undefined {
  const endpoint = resource.endpoint.trim();
  if (resource.kind === 'device') {
    const match = /^(?:[a-z\d.-]+|\[[a-f\d:]+\]):(\d{1,5})$/i.exec(endpoint);
    const port = Number(match?.[1]);
    if (!match || port < 1 || port > 65535) return '请输入有效的设备地址和端口。';
  } else {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        return '请输入 HTTPS 地址，将认证配置单独填写为引用。';
      }
    } catch {
      return '请输入有效的 HTTPS 地址。';
    }
  }
}
