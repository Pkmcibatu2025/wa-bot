import express from "express";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import moment from "moment";

const app = express();
app.use(express.json());

let sock = null;

// Jam kerja
const START_HOUR = 8;  // 08:00
const END_HOUR = 14;   // 14:00

async function startSock() {
  if (sock) return; // Sudah jalan
  console.log("🚀 Memulai WhatsApp Bot...");

  const { state, saveCreds } = await useMultiFileAuthState("./session");
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ["SISUKES Bot", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("✅ Connected to WhatsApp");
    else if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("⚠️ Connection closed, reconnecting...");
        sock = null;
        startSock();
      } else {
        console.log("❌ Session logout. Hapus folder /session dan scan ulang.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// Endpoint kirim pesan teks
app.post("/send", async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!sock) return res.status(400).json({ success: false, message: "Bot belum terhubung" });
    await sock.sendMessage(to + "@s.whatsapp.net", { text });
    res.json({ success: true, message: "Pesan terkirim ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint khusus format SISUKES
app.post("/sisukes", async (req, res) => {
  try {
    const { nama, hasil, tanggal, dokter, to } = req.body;
    const text = `📋 *SISUKES Notification*\n\n👤 Nama: ${nama}\n📅 Tanggal: ${tanggal}\n🩺 Dokter: ${dokter}\n💡 Hasil: ${hasil}\n\nTerima kasih telah menggunakan layanan SISUKES.`;
    if (!sock) return res.status(400).json({ success: false, message: "Bot belum terhubung" });
    await sock.sendMessage(to + "@s.whatsapp.net", { text });
    res.json({ success: true, message: "Notifikasi SISUKES terkirim ✅" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint ping untuk keep-alive Railway
app.get("/ping", (req, res) => res.send("Pong! Bot aktif ✅"));

// Server Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server berjalan di port ${PORT}`));

// Cek jam kerja setiap menit, start/stop bot otomatis
setInterval(async () => {
  const hour = moment().hour();
  if (hour >= START_HOUR && hour < END_HOUR) {
    if (!sock) await startSock();
  } else {
    if (sock) {
      console.log("⏰ Diluar jam kerja, bot dimatikan.");
      sock.ws.close();
      sock = null;
    }
  }
}, 60 * 1000); // cek setiap menit
