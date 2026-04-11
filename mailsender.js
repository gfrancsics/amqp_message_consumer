const { google } = require('googleapis');

// A változókat a process.env-ből vesszük (amiket a Renderen beállítottál)
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL_USER = process.env.EMAIL_USER;

// OAuth2 kliens beállítása
const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

/**
 * Email küldése Gmail API-n keresztül (HTTP port 443)
 * Kikerüli az SMTP blokkolást.
 */
async function sendNotificationEmail(data) {
    try {
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        // Tárgy mező kódolása (hogy az ékezetek ne törjenek meg)
        const subject = `🚨 ${data.urgent ? 'SÜRGŐS: ' : ''}Új hiba: ${data.subject}`;
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

        // Az email nyers szövege RFC 2822 formátumban
        const messageParts = [
            `From: "Hibafigyelő" <${EMAIL_USER}>`,
            `To: ${EMAIL_USER}`,
            `Content-Type: text/html; charset=utf-8`,
            `MIME-Version: 1.0`,
            `Subject: ${utf8Subject}`,
            '',
            `<div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; border-radius: 10px; background-color: #f9f9f9;">
                <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">Új hibabejelentés érkezett!</h2>
                <p><strong>Küldő:</strong> ${data.email}</p>
                <p><strong>Név:</strong> ${data.firstName} ${data.lastName}</p>
                <p><strong>Telefon:</strong> ${data.phone || 'Nincs megadva'}</p>
                <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #eee;">
                    <strong>Üzenet:</strong><br>${data.message}
                </div>
                <p><strong>Sürgősség:</strong> ${data.urgent ? '<span style="color: red; font-weight: bold;">🔥 SÜRGŐS</span>' : 'Normál'}</p>
                <p style="font-size: 12px; color: #777; margin-top: 20px;">Időpont: ${new Date().toLocaleString('hu-HU')}</p>
            </div>`
        ];

        const message = messageParts.join('\n');

        // A Gmail API "base64url" kódolt nyers szöveget vár
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // Tényleges küldés HTTP kéréssel
        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        if (res.data.id) {
            console.log(`✅ Email sikeresen elküldve (Gmail API). ID: ${res.data.id}`);
            return true;
        }
        return false;

    } catch (error) {
        console.error("❌ Gmail API hiba:", error.message);
        // Ha "invalid_grant" jönne vissza, akkor a token lejárt
        if (error.message.includes('invalid_grant')) {
            console.error("⚠️ A Refresh Token lejárt vagy érvénytelen!");
        }
        return false;
    }
}

module.exports = { sendNotificationEmail };