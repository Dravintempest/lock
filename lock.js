// lock.js - Termux Lock
const readline = require("readline");
const fs = require("fs");

const correctCode = "12345"; // ganti dengan kode kamu
const logFile = `${process.env.HOME}/.termux_lock_log`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askCode() {
  rl.question("Masukkan kode akses: ", (answer) => {
    if (answer === correctCode) {
      console.log("\n✅ Kode benar! Selamat datang.\n");
      rl.close();
    } else {
      console.log("\n❌ Kode salah! Termux terkunci.\n");
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] Salah kode: ${answer}\n`);
      process.exit(1);
    }
  });
}

askCode();
