/**
 * 清除 USB Key 中所有证书（容器），为后期重新签发证书做准备。
 *
 * 用法: node clear-usbkey-certs.js [ws://127.0.0.1:9001] [123456]
 */

const WebSocket = require('ws');

const SKF_URL = process.argv[2] || 'ws://127.0.0.1:9001';
const PIN = process.argv[3] || '123456';

let msgId = 1;
const callbacks = new Map();

function call(ws, method, params = []) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
  });
}

async function clearAllCerts() {
  const ws = new WebSocket(SKF_URL);

  return new Promise((resolve, reject) => {
    ws.on('open', async () => {
      console.log('✅ 已连接 SKF 服务:', SKF_URL);

      try {
        const providers = await call(ws, 'EnumProvider');
        console.log('📋 设备提供商:', providers);

        let total = 0;

        for (const provider of providers) {
          const devices = await call(ws, 'EnumDevice', [provider]);
          console.log(`  📋 ${provider} 设备:`, devices);

          for (const device of devices) {
            const apps = await call(ws, 'EnumApplication', [provider, device]);
            console.log(`    📋 ${device} 应用:`, apps);

            for (const app of apps) {
              try {
                await call(ws, 'CheckPIN', [`${provider}/${device}/${app}`, PIN]);
              } catch (e) {
                console.log(`    ⚠️ ${app} PIN 验证失败: ${e.message}`);
                continue;
              }

              const containers = await call(ws, 'EnumContainer', [provider, device, app]);
              console.log(`    📋 ${app} 容器:`, containers);

              for (const container of containers) {
                try {
                  await call(ws, 'DeleteContainer', [provider, device, app, container]);
                  console.log(`    🗑️ 已删除: ${app}/${container}`);
                  total++;
                } catch (e) {
                  console.log(`    ❌ 删除失败 ${app}/${container}: ${e.message}`);
                }
              }
            }
          }
        }
        console.log(`\n✅ 清除完成，共删除 ${total} 个容器`);
        ws.close();
        resolve();
      } catch (e) {
        console.error('❌ 错误:', e.message);
        ws.close();
        reject(e);
      }
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id && callbacks.has(msg.id)) {
          const { resolve: res, reject: rej } = callbacks.get(msg.id);
          callbacks.delete(msg.id);
          msg.error ? rej(new Error(msg.message || `Error ${msg.error}`)) : res(msg.result);
        }
      } catch (e) {
        console.error('消息解析失败:', e.message);
      }
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket 连接失败:', err.message);
      reject(err);
    });
  });
}

clearAllCerts()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
