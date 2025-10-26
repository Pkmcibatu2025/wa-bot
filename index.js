import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";

const app = express();
const port = 3000; // ganti kalau bentrok

let sock;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  sock = makeWASocket({
    auth: state,
    browser: ["SISUKES BOT", "Chrome", "1.0.0"],
  });

  // tampilkan QR manual
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("🔵 Scan QR ini untuk login WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected!");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Koneksi terputus, reconnect =", shouldReconnect);
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// === API sederhana ===
app.get("/", (req, res) => res.send("✅ SISUKES WA Bot aktif."));
app.get("/send", async (req, res) => {
  const nomor = req.query.to;
  const pesan = req.query.msg || "Halo dari SISUKES WA Bot!";
  if (!nomor) return res.status(400).send("Nomor tidak boleh kosong.");
  try {
    await sock.sendMessage(`${nomor}@s.whatsapp.net`, { text: pesan });
    res.send(`✅ Pesan terkirim ke ${nomor}`);
  } catch (err) {
    console.error("Error kirim pesan:", err);
    res.status(500).send("Gagal mengirim pesan.");
  }
});

app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));

startBot();
