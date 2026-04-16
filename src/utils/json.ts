/**
 * 解析带有注释的 JSON 字符串
 * @param jsonStr JSON 字符串
 * @returns 解析后的对象
 */
export function parseJson(jsonStr: string | null | undefined): any {
  if (!jsonStr) return null;
  if (typeof jsonStr !== 'string') return jsonStr;
  
  try {
    // 移除 JSON 中的注释 (// ... 或 /* ... */)
    // 同时也处理了字符串中包含 // 的情况
    const cleanJsonStr = jsonStr.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
    return JSON.parse(cleanJsonStr);
  } catch (e) {
    console.error('JSON parse error:', e);
    console.error('Original string:', jsonStr);
    throw e;
  }
}

/**
 * 解析证书模板中的密钥算法列表
 * @param {Array} keyAlgorithms 原始算法列表
 * @returns {Array} 解析后的字符串列表
 */
export const parseKeyAlgorithms = (keyAlgorithms: any[]): string[] => {
  if (!keyAlgorithms || !Array.isArray(keyAlgorithms)) return [];
  
  const algos: string[] = [];
  keyAlgorithms.forEach((a: any) => {
    if (typeof a === 'string') {
      algos.push(a);
      return;
    }
    
    // 处理复杂结构: { algorithms: [{ oid, description }], parameters: {...} }
    const mainDesc = a.algorithms?.[0]?.description;
    if (mainDesc === 'RSA' && a.parameters?.rsa?.modulus) {
      a.parameters.rsa.modulus.forEach((m: number) => {
        algos.push(`RSA${m}`);
      });
    } else if (mainDesc === 'EC' && a.parameters?.ec?.curves?.[0]?.description?.toLowerCase().includes('sm2')) {
      algos.push('SM2');
    } else if (mainDesc === 'EC' && a.parameters?.ec?.curves?.[0]?.description) {
      algos.push(a.parameters.ec.curves[0].description.toUpperCase());
    } else if (mainDesc) {
      // 支持 PQC (ML-DSA 等) 或其他直接在 description 中定义的算法
      algos.push(mainDesc);
    } else if (a.name || a.type) {
      algos.push(a.name || a.type);
    }
  });
  
  return algos;
};
