const { Client } = require('ssh2');

/**
 * Jalankan satu command di server VPS lewat SSH, dan kembalikan
 * output teks yang dicetak command tersebut (stdout).
 *
 * @param {Object} server  - { ip, sshPort, sshUser, sshPassword }
 * @param {string} command - command SIAP JALAN (variabel {username}/{password}/{days}
 *                            sudah diganti sebelumnya oleh pemanggil)
 * @param {number} timeoutMs - batas waktu tunggu (default 30 detik)
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
function runCommand(server, command, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn.end();
      reject(new Error(`Timeout: server tidak merespons dalam ${timeoutMs / 1000} detik.`));
    }, timeoutMs);

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            if (!settled) {
              settled = true;
              reject(err);
            }
            return;
          }

          stream
            .on('close', (code) => {
              clearTimeout(timer);
              conn.end();
              if (!settled) {
                settled = true;
                resolve({ stdout, stderr, code });
              }
            })
            .on('data', (data) => {
              stdout += data.toString('utf-8');
            })
            .stderr.on('data', (data) => {
              stderr += data.toString('utf-8');
            });
        });
      })
      .on('error', (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
      })
      .connect({
        host: server.ip,
        port: Number(server.sshPort) || 22,
        username: server.sshUser,
        password: server.sshPassword,
        readyTimeout: 15000,
      });
  });
}

/**
 * Ganti placeholder {username}, {password}, {days} di dalam template
 * command dengan nilai sebenarnya. Placeholder yang tidak dikenal
 * dibiarkan apa adanya (tidak error).
 */
function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match;
  });
}

/**
 * Buat username & password acak sederhana untuk akun baru.
 * Format: prefix + 6 karakter acak, biar mudah diingat & jarang bentrok.
 */
function generateCredentials(prefix = 'user') {
  const rand = () => Math.random().toString(36).slice(2, 8);
  return {
    username: `${prefix}${rand()}`,
    password: rand() + rand().slice(0, 3),
  };
}

module.exports = { runCommand, fillTemplate, generateCredentials };
