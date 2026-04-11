const nodemailer = require('nodemailer');

const EMAIL_USER = 'gergely.francsics@gmail.com';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// A transzporter konfigurálása az OAuth2 adatokkal
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: EMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN
    }
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