const nodemailer = require('nodemailer');

const EMAIL_USER = 'gergely.francsics@gmail.com';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// A transzporter konfigurálása az OAuth2 adatokkal
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         type: 'OAuth2',
//         user: EMAIL_USER,
//         clientId: CLIENT_ID,
//         clientSecret: CLIENT_SECRET,
//         refreshToken: REFRESH_TOKEN
//     }
// });
// const transporter = nodemailer.createTransport({
//     // A 'service: gmail' helyett manuálisan adjuk meg a szervert
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true, // Port 465-höz ez kötelező (SSL)
//     auth: {
//         type: 'OAuth2',
//         user: process.env.EMAIL_USER,
//         clientId: process.env.CLIENT_ID,
//         clientSecret: process.env.CLIENT_SECRET,
//         refreshToken: process.env.REFRESH_TOKEN
//     },
//     // Ez a rész tiltja le az IPv6-ot, ami a 'connect ENETUNREACH' hibát okozza
//     dnsV6: false,
//     connectionTimeout: 10000, // 10 mp timeout
//     greetingTimeout: 10000
// });
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS-hez ez FALSE kell, hogy legyen!
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN
    },
    tls: {
        // Ez kényszeríti a biztonságos protokollt, de engedékenyebb a tanúsítványokkal
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
    },
    dnsV6: false, // Maradjon kikapcsolva az IPv6
    connectionTimeout: 20000, // Emeljük meg 20 mp-re a türelmi időt
    greetingTimeout: 20000
});


// Email küldő függvény
async function sendNotificationEmail(data) {
    const mailOptions = {
        from: `"Hibafigyelő" <${EMAIL_USER}>`,
        to: EMAIL_USER, // Magadnak küldöd az értesítést
        subject: `🚨 ${data.urgent ? 'SÜRGŐS: ' : ''}Új hiba: ${data.subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; border-radius: 10px;">
                <h2 style="color: #d32f2f;">Új hibabejelentés érkezett!</h2>
                <p><strong>Feladó:</strong> ${data.email}</p>
                <p><strong>Név:</strong> ${data.firstName} ${data.lastName}</p>
                <p><strong>Telefonszám:</strong> ${data.phone}</p>
                
                <p><strong>Leírás:</strong> ${data.message}</p>
                <p><strong>Sürgősség:</strong> ${data.urgent ? '🔥 IGEN' : 'Normál'}</p>
                <p><strong>Időpont:</strong> ${new Date().toLocaleString('hu-HU')}</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("📧 Email sikeresen kiküldve (OAuth2 használatával)");
        return true;
    } catch (error) {
        console.error("❌ Nodemailer hiba:", error);
        return false;
    }
}

module.exports = { sendNotificationEmail };

// Itt jön a már megírt RabbitMQ consume rész:
// ... channel.consume(QUEUE_NAME, async (msg) => { ...
// A MongoDB mentés után (await ujHiba.save();) hívd meg a függvényt:
// await sendNotificationEmail(data);
// ...

// sendNotificationEmail({
//     topic: 'példa',
//     urgent: false,
//     email: 'gergely.francsics@gmail.com',
//     description: 'pl'
// });