/**
 * SKF Service Client Library
 *
 * Provides a Promise-based interface for the SKF WebSocket Service.
 *
 * Usage:
 *   const skf = new SKFClient('ws://127.0.0.1:9001');
 *   skf.on('connect', () => console.log('Connected!'));
 *   skf.connect();
 *
 *   skf.enumProvider().then(providers => console.log(providers));
 */

export default class SKFClient {
  constructor(url = 'ws://127.0.0.1:9001') {
    this.url = url;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.eventListeners = {
      connect: [],
      disconnect: [],
      error: []
    };
  }

  // Event Handling
  on(event, handler) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(handler);
    }
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((handler) => handler(data));
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
          }
        } catch (e) {
          /* ignore */
        }
        this.ws = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      try {
        this.ws = new WebSocket(this.url);
        timer = setTimeout(() => {
          fail(new Error(`连接本机 SKF 服务超时（${this.url}），请确认 SKF 服务已启动`));
        }, 4000);

        this.ws.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.emit('connect');
          resolve();
        };

        this.ws.onclose = () => {
          this.emit('disconnect');
          fail(new Error(`SKF 服务连接已断开（${this.url}）`));
        };

        this.ws.onerror = () => {
          this.emit('error');
          fail(new Error(`无法连接本机 SKF 服务（${this.url}），请确认 SKF 服务已启动`));
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id && this.callbacks.has(data.id)) {
              const { resolve: ok, reject: no } = this.callbacks.get(data.id);
              this.callbacks.delete(data.id);
              if (data.error) {
                no({ code: data.error, message: data.message || 'Unknown Error' });
              } else {
                ok(data.result);
              }
            }
          } catch (e) {
            console.error('SKFClient: Failed to parse message', e);
          }
        };
      } catch (e) {
        fail(e);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  call(method, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Not connected to SKF Service'));
        return;
      }

      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });

      const req = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: id
      };

      this.ws.send(JSON.stringify(req));
    });
  }

  // --- High-Level API ---

  /**
   * Set the service language for error messages.
   * @param {string} lang "CN" or "EN"
   */
  async setLanguage(lang) {
    return this.call('SetLanguage', [lang]);
  }

  /**
   * Enumerate available providers.
   * @param {string} [vpid] Optional "VID:PID" filter
   * @returns {Promise<string[]>} List of provider names
   */
  async enumProvider(vpid) {
    const params = vpid ? [vpid] : [];
    const res = await this.call('EnumProvider', params);
    // Normalize result to array
    return Array.isArray(res) ? res : res ? [res] : [];
  }

  /**
   * Enumerate devices for a specific provider.
   * @param {string} provider Provider name (from enumProvider)
   * @returns {Promise<string[]>} List of device names
   */
  async enumDevice(provider) {
    const res = await this.call('EnumDevice', [provider]);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Block and wait for a device event (plug/unplug)
   * @param {string} provider Provider name
   * @returns {Promise<{deviceName: string, event: number}>} Event details (event 1=insert, 2=remove)
   */
  async waitForDevEvent(provider) {
    return this.call('WaitForDevEvent', [provider]);
  }

  async waitForDeviceEvent(provider) {
    return this.waitForDevEvent(provider);
  }

  /**
   * Enumerate applications on a specific device.
   * @param {string} provider Provider name
   * @param {string} deviceName Device name
   * @returns {Promise<string[]>} List of application names
   */
  async enumApplication(provider, deviceName) {
    const res = await this.call('EnumApplication', [provider, deviceName]);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Enumerate containers in a specific application.
   * @param {string} provider Provider name
   * @param {string} deviceName Device name
   * @param {string} appName Application name
   * @returns {Promise<string[]>} List of container names
   */
  async enumContainer(provider, deviceName, appName) {
    const res = await this.call('EnumContainer', [provider, deviceName, appName]);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Delete a container in a specific application.
   * @param {string} provider Provider name
   * @param {string} deviceName Device name
   * @param {string} appName Application name
   * @param {string} containerName Container name
   * @returns {Promise<boolean>} True if successful
   */
  async deleteContainer(provider, deviceName, appName, containerName) {
    return this.call('DeleteContainer', [provider, deviceName, appName, containerName]);
  }

  /**
   * Create a container in a specific application.
   * @param {string} provider Provider name
   * @param {string} deviceName Device name
   * @param {string} appName Application name
   * @param {string} containerName Container name
   * @returns {Promise<string|boolean>} Created container name or true if successful
   */
  async createContainer(provider, deviceName, appName, containerName) {
    return this.call('CreateContainer', [provider, deviceName, appName, containerName]);
  }

  /**
   * Issue a certificate from a CSR (for testing).
   * @param {string} csr PEM or Base64 encoded PKCS#10 CSR
   * @param {boolean} [double=false] If true, generate double cert (sign + enc + ENVELOPEDKEYBLOB)
   * @returns {Promise<Object>} Object with certificate, certificate2?, encPriKey?, sessKey?, alg?, double
   */
  async issueCertificate(csr, double = false) {
    return this.call('IssueCertificate', [csr, double]);
  }

  /**
   * Import a certificate into a container.
   * @param {string} provider Provider name
   * @param {string} deviceName Device name
   * @param {string} appName Application name
   * @param {string} containerName Container name
   * @param {boolean} isSignCert True for signature certificate, false for encryption
   * @param {string} certData PEM or Base64 encoded certificate
   * @returns {Promise<boolean>} True if successful
   */
  async importCertificate(provider, deviceName, appName, containerName, isSignCert, certData) {
    return this.call('ImportCertificate', [provider, deviceName, appName, containerName, isSignCert, certData]);
  }

  /**
   * Import an encrypted key pair into the container.
   * @param {string} provider Provider name
   * @param {string} deviceName Device name
   * @param {string} appName Application name
   * @param {string} containerName Container name
   * @param {string} alg Algorithm ("SM2", "RSA")
   * @param {string} encKeyPair Base64 encoded encrypted key pair
   * @param {string} [wrapKey=""] Base64 encoded wrap key (RSA only)
   * @returns {Promise<boolean>} Success status
   */
  async importKeyPair(provider, deviceName, appName, containerName, alg, encKeyPair, wrapKey = '', symmetricMode = 'ECB') {
    return this.call('ImportKeyPair', [provider, deviceName, appName, containerName, alg, encKeyPair, wrapKey, symmetricMode]);
  }

  /**
   * Connect to a specific device.
   * @param {string} deviceName Device name (from enumDevice)
   * @returns {Promise<string|number>} Device handle
   */
  async connectDev(deviceName) {
    return this.call('ConnectDev', [deviceName]);
  }

  /**
   * Disconnect from a device.
   * @param {string|number} handle Device handle
   * @returns {Promise<boolean>} Success status
   */
  async disconnectDev(handle) {
    return this.call('DisConnectDev', [handle]);
  }

  /**
   * Generate random data from the device.
   * @param {string|number} handle Device handle
   * @param {number} length Length in bytes
   * @returns {Promise<string>} Base64 encoded random data
   */
  async generateRandom(handle, length) {
    return this.call('GenerateRandom', [handle, length]);
  }

  /**
   * Find certificates on all connected devices.
   * @param {string} filter "Sign", "Enc", or empty for all
   * @returns {Promise<Array<{key:string, value:string, type:string, cert:string}>>} List of certificates
   */
  async findCertificates(filter = '') {
    const res = await this.call('FindCertificates', [filter]);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Sign data using the specified certificate container.
   * @param {string} certKey Certificate key path (provider/device/app/container/serial)
   * @param {string} dataBase64 Data to sign (base64 encoded)
   * @returns {Promise<string>} Base64-encoded signature (r || s)
   */
  async signData(certKey, dataBase64) {
    return this.call('SignData', [certKey, dataBase64]);
  }

  /**
   * Verify an ECC/SM2 signature using the public key from a certificate.
   * @param {string} providerName Provider name
   * @param {string} deviceName Device name
   * @param {string} pubKeyBase64 ECCPUBLICKEYBLOB (base64 encoded)
   * @param {string} dataBase64 Original data (base64 encoded)
   * @param {string} signatureBase64 ECCSIGNATUREBLOB (base64 encoded)
   * @returns {Promise<boolean>} True if signature is valid
   */
  async eccVerify(providerName, deviceName, pubKeyBase64, dataBase64, signatureBase64) {
    return this.call('ECCVerify', [providerName, deviceName, pubKeyBase64, dataBase64, signatureBase64]);
  }

  /**
   * Verify a PIN for a specific application.
   * @param {string} certKey Certificate key path (at least provider/device/app)
   * @param {string} pin User PIN
   * @returns {Promise<boolean>} True if PIN is correct
   */
  async checkPIN(certKey, pin) {
    return this.call('CheckPIN', [certKey, pin]);
  }

  /**
   * Compute a hash digest using the device.
   * @param {string} providerName Provider name
   * @param {string} deviceName Device name
   * @param {string} dataBase64 Data to hash (base64 encoded)
   * @param {string} [alg="SM3"] Algorithm: "SM3", "SHA1", "SHA256"
   * @returns {Promise<{hex:string, base64:string, algorithm:string, length:number}>}
   */
  async digest(providerName, deviceName, dataBase64, alg = 'SM3') {
    return this.call('Digest', [providerName, deviceName, dataBase64, alg]);
  }

  /**
   * Create a PKCS#10 Certificate Signing Request.
   * @param {string} providerName Provider name
   * @param {string} deviceName Device name
   * @param {string} appName Application name
   * @param {string} subject Subject DN, e.g. "CN=Test,O=MyOrg,C=CN"
   * @param {string} [keyType="SM2"] Key type: "SM2" or "RSA"
   * @param {number} [keyLength=256] Key length in bits
   * @param {string} [containerName=""] Optional container name
   * @returns {Promise<{pem:string, container:string, keyType:string, keyLength:number}>}
   */
  async createPKCS10(providerName, deviceName, appName, subject, keyType = 'SM2', keyLength = 256, containerName = '') {
    return this.call('CreatePKCS10', [providerName, deviceName, appName, subject, keyType, keyLength, containerName]);
  }
}
