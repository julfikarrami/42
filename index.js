const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');

const ADMIN = "8801XXXXXXXXX@c.us"; // শুধু Admin
let GROUP = "";

// EXPRESS QR Server
const app = express();
let latestQR = "";
app.get("/", (req,res)=>{
    if(!latestQR) return res.send("QR not ready, wait a few seconds...");
    res.send(`<h3>Scan QR for WhatsApp Bot</h3><img src="${latestQR}" width="300">`);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`QR Server ready at http://localhost:${PORT}`));

// WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth({ dataPath:'./session' }),
    puppeteer: { headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] }
});

// QR Generate
client.on('qr', async qr=>{
    latestQR = await qrcode.toDataURL(qr);
    console.log("QR ready! Open your browser at Railway URL to scan.");
});

client.on('ready',()=>console.log("🟢 BOT ONLINE"));

// GRUPID Auto detect
client.on('message', async msg=>{
    if(!GROUP && msg.from.includes("@g.us")){
        GROUP = msg.from;
        console.log("GROUP ID:", GROUP);
    }

    if(msg.from!==ADMIN) return;
    if(!msg.body.startsWith("/add")) return;

    let l = msg.body.split("\n");
    let name = l[1].split(":")[1].trim();
    let prayers = [
        ["ফজর", l[2].includes("yes")],
        ["যোহর", l[3].includes("yes")],
        ["আসর", l[4].includes("yes")],
        ["মাগরিব", l[5].includes("yes")],
        ["এশা", l[6].includes("yes")]
    ];

    let today = prayers.filter(p=>p[1]).length*10;
    let db = {};
    if(fs.existsSync("data.json")) db=JSON.parse(fs.readFileSync("data.json"));
    if(!db[name]) db[name]=0;
    db[name]+=today;
    fs.writeFileSync("data.json", JSON.stringify(db,null,2));

    let miss = prayers.filter(p=>!p[1]).map(p=>p[0]).join(", ");

    await msg.reply(`🕌 রিপোর্ট
👤 ${name}
⭐ আজ: ${today}
📊 মোট: ${db[name]}`);

    if(miss.length>0)
        client.sendMessage(GROUP, `⚠️ ${name} আজ ${miss} নামাজ পড়েনি`);
});

// নামাজ সময় (Rajshahi)
async function schedule(){
    let r = await axios.get("https://api.aladhan.com/v1/timingsByCity?city=Rajshahi&country=Bangladesh&method=1");
    let t = r.data.data.timings;

    function set(time,text){
        let [h,m]=time.split(":");
        cron.schedule(`${m} ${h} * * *`, ()=>client.sendMessage(GROUP,text));
    }

    set(t.Fajr,"⏰ ফজরের সময় হয়েছে\nনিয়ত: আমি আল্লাহর সন্তুষ্টির জন্য ফজরের নামাজ আদায় করছি");
    set(t.Dhuhr,"🕌 যোহরের সময় হয়েছে\nনিয়ত: আমি আল্লাহর সন্তুষ্টির জন্য নামাজ আদায় করছি");
    set(t.Asr,"🕌 আসরের সময় হয়েছে\nনিয়ত: আমি আল্লাহর সন্তুষ্টির জন্য নামাজ আদায় করছি");
    set(t.Maghrib,"🌙 ইফতারের সময় হয়েছে\nনিয়ত: আমি আল্লাহর সন্তুষ্টির জন্য রোজা ভঙ্গ করছি");
    set(t.Isha,"🕌 এশার সময় হয়েছে\nনিয়ত: আমি আল্লাহর সন্তুষ্টির জন্য নামাজ আদায় করছি");

    // সেহরি শেষ এলার্ট
    let [fh,fm] = t.Fajr.split(":");
    fm = parseInt(fm)-10;
    cron.schedule(`${fm} ${fh} * * *`, ()=>client.sendMessage(GROUP,"⚠️ সেহরির শেষ সময় ১০ মিনিট বাকি!"));
}

setTimeout(schedule,15000);
client.initialize();
