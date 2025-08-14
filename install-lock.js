// install-lock.js - Pasang lock ke Termux
const fs = require("fs");
const path = require("path");

const bashrc = path.join(process.env.HOME, ".bashrc");
const lockCmd = `node ${path.join(process.cwd(), "lock.js")} || exit`;

if (!fs.existsSync(bashrc)) {
  fs.writeFileSync(bashrc, "");
}

let bashrcContent = fs.readFileSync(bashrc, "utf8");

if (!bashrcContent.includes(lockCmd)) {
  fs.appendFileSync(bashrc, `\n# Termux Lock\n${lockCmd}\n`);
  console.log("✅ Lock berhasil dipasang. Silakan keluar dan buka Termux lagi.");
} else {
  console.log("🔒 Lock sudah terpasang. Silakan keluar dan buka Termux lagi.");
}
