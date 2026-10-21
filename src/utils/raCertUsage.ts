/** Resolve CA template mandatory and selectable certificate usages. */
export function resolveTemplateUsages(rule: any, normalize: (values: any[]) => string[]) {
  const required: any[] = [...(Array.isArray(rule?.required) ? rule.required : [])];
  const optional: any[] = [...(Array.isArray(rule?.optional) ? rule.optional : [])];
  for (const usage of Array.isArray(rule?.usages) ? rule.usages : []) {
    if (typeof usage === 'object' && usage !== null) {
      if (Array.isArray(usage.required)) required.push(...usage.required);
      if (Array.isArray(usage.optional)) optional.push(...usage.optional);
      if (usage.value || usage.oid || usage.description) {
        (usage.required === true ? required : optional).push(usage);
      }
    } else {
      optional.push(usage);
    }
  }
  const requiredUsages = [...new Set(normalize(required))];
  return { requiredUsages, allowedUsages: [...new Set([...requiredUsages, ...normalize(optional)])] };
}
