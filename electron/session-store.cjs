const fs = require("node:fs/promises");
const path = require("node:path");

const asyncCrypt = 2;
const windowsCrypt = 1;

function makeSessionStore(storage, filename) {
  const temporary = filename + ".new";
  let tail = Promise.resolve();

  function run(operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }

  async function write(encrypted, provider) {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(temporary, Buffer.concat([Buffer.from([provider]), encrypted]), { mode: 0o600 });
    await fs.rename(temporary, filename);
  }

  return {
    load: () => run(async () => {
      try {
        const encrypted = await fs.readFile(filename);
        if (encrypted.length < 2 || encrypted.length > 32_768) return null;
        const data = encrypted.subarray(1);
        if (encrypted[0] === windowsCrypt && storage.isEncryptionAvailable?.()) {
          return JSON.parse(storage.decryptString(data));
        }
        if (encrypted[0] === asyncCrypt && await storage.isAsyncEncryptionAvailable()) {
          const decrypted = await storage.decryptStringAsync(data);
          if (decrypted.shouldReEncrypt) await write(await storage.encryptStringAsync(decrypted.result), asyncCrypt);
          return JSON.parse(decrypted.result);
        }
        return null;
      } catch { return null; }
    }),
    save: value => run(async () => {
      const plain = JSON.stringify(value);
      if (await Promise.resolve().then(() => storage.isAsyncEncryptionAvailable()).catch(() => false)) {
        try {
          await write(await storage.encryptStringAsync(plain), asyncCrypt);
          return true;
        } catch { /* Fall back to the Windows DPAPI provider when available. */ }
      }
      if (process.platform !== "win32" || !storage.isEncryptionAvailable?.()) return false;
      await write(storage.encryptString(plain), windowsCrypt);
      return true;
    }),
    clear: () => run(async () => {
      await fs.rm(filename, { force: true });
      await fs.rm(temporary, { force: true });
    }),
    flush: () => tail,
  };
}

module.exports = { makeSessionStore };
