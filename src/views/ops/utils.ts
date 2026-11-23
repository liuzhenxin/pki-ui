import type { OpsComponent, OpsContainer, OpsContainerVersion, OpsOverview, OpsServer, OpsSummary } from '@/api/ops/types';

export const containerImageTag = (image: string) => {
  if (image.includes('@')) return '';
  const lastSlash = image.lastIndexOf('/');
  const lastColon = image.lastIndexOf(':');
  return lastColon > lastSlash ? image.slice(lastColon + 1) : '';
};

export const matchesContainerVersion = (
  container: Pick<OpsContainer, 'image' | 'imageDigest'>,
  version: Pick<OpsContainerVersion, 'currentTag' | 'currentDigest'>
) => version.currentTag === containerImageTag(container.image) && (version.currentDigest ?? '') === (container.imageDigest ?? '');

export const statusTagType = (status?: string, running?: boolean, present = true) => {
  if (!present) {
    return 'danger';
  }
  if (running || status === 'UP' || status === 'running') {
    return 'success';
  }
  if (status === 'DEGRADED' || status?.includes('starting')) {
    return 'warning';
  }
  return 'danger';
};

export const statusText = (status?: string, running?: boolean, present = true) => {
  if (!present) {
    return '未发现';
  }
  if (running || status === 'UP' || status === 'running') {
    return '运行中';
  }
  if (status === 'DEGRADED') {
    return '降级';
  }
  if (status === 'DOWN') {
    return '离线';
  }
  return status || '未知';
};

export const componentDeploymentText = (component: OpsComponent) => (component.deployment === 'EXTERNAL' ? '外部提供' : '内部部署');

export const componentStatusText = ({ deployment, availability, container }: OpsComponent) =>
  deployment === 'EXTERNAL'
    ? { UP: '可用', DOWN: '不可用', UNKNOWN: '待确认', DISABLED: '未启用' }[availability?.state ?? 'UNKNOWN']
    : statusText(container?.state, container?.running, container?.present);

export const componentStatusTagType = ({ deployment, availability, container }: OpsComponent) =>
  deployment === 'EXTERNAL'
    ? ({ UP: 'success', DOWN: 'danger', UNKNOWN: 'info', DISABLED: 'info' } as const)[availability?.state ?? 'UNKNOWN']
    : statusTagType(container?.state, container?.running, container?.present);

export const isComponentAbnormal = ({ deployment, availability, container }: OpsComponent) =>
  deployment === 'EXTERNAL' ? availability?.state === 'DOWN' : !container?.running;

export const percentText = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-';
  }
  return `${Number(value).toFixed(1)}%`;
};

export const dateTimeText = (value?: string) => {
  if (!value) {
    return '-';
  }
  return value.replace('T', ' ').replace(/\.\d+.*/, '');
};

export const flattenComponents = (overview?: OpsOverview) => {
  return (overview?.layers || []).flatMap((layer) =>
    layer.components.map((component) => ({ ...component, layerName: layer.name, layerOrder: layer.order }))
  );
};

export const dependencyLabel = (code: string, overview?: OpsOverview) => {
  if (code === 'database') {
    return '外部数据库';
  }
  if (code === 'mysql8') {
    const resources = overview?.layers.find((layer) => layer.code === 'infrastructure')?.components;
    if (resources?.some((component) => component.name === 'database' && component.deployment === 'EXTERNAL')) {
      return '外部数据库';
    }
    const mysql = resources?.find((component) => component.name === code);
    return mysql?.container?.present ? mysql.displayName : '数据库';
  }
  return code;
};

export const collectContainers = (servers: OpsServer[], fallback: OpsContainer[] = []) => {
  const fromServers = servers.flatMap((server) =>
    server.containers.map((container) => ({ ...container, serverCode: server.code, serverName: server.name, serverHost: server.host }))
  );
  if (fromServers.length > 0) {
    return fromServers;
  }
  return fallback.map((container) => ({ ...container, serverCode: '-', serverName: '-', serverHost: '-' }));
};

export const findOverviewAgent = (containers: ReturnType<typeof collectContainers>, serverCode: string) => {
  if (serverCode) {
    return containers.find((container) => container.serverCode === serverCode);
  }
  return containers.length === 1 ? containers[0] : undefined;
};

export const buildSummary = (overview?: OpsOverview, servers: OpsServer[] = [], containers: OpsContainer[] = []): OpsSummary => {
  const components = flattenComponents(overview);
  const allContainers = collectContainers(servers, containers);
  return {
    serverCount: servers.length,
    onlineServerCount: servers.filter((server) => server.online).length,
    containerCount: allContainers.length,
    runningContainerCount: allContainers.filter((container) => container.running).length,
    componentCount: components.length,
    runningComponentCount: components.filter((component) =>
      component.deployment === 'EXTERNAL' ? component.availability?.state === 'UP' : component.container?.running
    ).length,
    abnormalComponentCount: components.filter(isComponentAbnormal).length
  };
};
