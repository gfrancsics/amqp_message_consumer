const express = require('express');
const amqp = require('amqplib');
const mongoose = require('mongoose');
const result = require('dotenv').config();
const { sendNotificationEmail } = require('./mailsender');

const app = express();


if (result.error) {
    console.error("❌ Hiba az .env fájl beolvasásakor:", result.error);
} else {
    console.log("✅ .env fájl sikeresen beolvasva.");
    // Csak ellenőrzésképpen, ne a titkos kulcsokat logold ki:
    console.log("Regisztrált EMAIL_USER:", process.env.EMAIL_USER ? "IGEN" : "NEM");
}

const PORT = 3400;
// const CLOUDAMQP_URL = 'amqps://vpwdmwwi:5WAHg6cVzwB0duCEeznFHl_W0eqfyF27@cow.rmq2.cloudamqp.com/vpwdmwwi';
const CLOUDAMQP_URL = process.env.CLOUDAMQP_URL;
const EXCHANGE_NAME = 'email';
const QUEUE_NAME = 'hibajelentesek_sora';
// const MONGO_URI = 'mongodb+srv://francsicsg_db_user:f0UBM8gnByvvfdax@cluster0.pnxpsjr.mongodb.net/contact?appName=Cluster0';
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("🍃 MongoDB kapcsolat kész."))
    .catch(err => console.error("❌ MongoDB hiba:", err));

const ContactSchema = new mongoose.Schema({
    id: String,
    topic: String,
    status: {
        type: String,
        default: 'uj'
    },
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    subject: String,
    message: String,
    urgent: Boolean,
    timestamp: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', ContactSchema);

// --- RABBITMQ CONSUMER LOGIKA ---
let isConsuming = false;

async function startConsumer() {
    if (isConsuming) return; // Ne indítsuk el többször

    try {
        const connection = await amqp.connect(CLOUDAMQP_URL);
        const channel = await connection.createChannel();

        // Struktúra biztosítása
        await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: true });
        await channel.assertQueue(QUEUE_NAME, { durable: true, autoDelete: false });
        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, '');

        console.log("📥 RabbitMQ figyelés elindult...");
        isConsuming = true;

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                try {
                    const data = JSON.parse(msg.content.toString());

                    const ujContact = new Contact(data);
                    await ujContact.save();

                    console.log("✅ Mentve a DB-be:", data.topic);
                    channel.ack(msg);
                } catch (err) {
                    console.error("❌ Feldolgozási hiba:", err.message);
                    // Hiba esetén nem ack-olunk, így az üzenet a sorban marad
                }
            }
        }, { noAck: false });

        connection.on("close", () => { isConsuming = false; });

    } catch (error) {
        console.error("❌ RabbitMQ hiba a Consumerben:", error.message);
        isConsuming = false;
    }
}

async function sendMail(res) {
    try {
        // 1. Lekérdezzük a MongoDB-ből azokat a hibákat, amik:
        // topic: 'activkom' ÉS status: 'új'
        const hibaLista = await Contact.find({
            topic: 'activcom',
            $or: [
                { status: 'uj' },
                { status: { $exists: false } } // Megtalálja a régi rekordokat is
            ]
        });

        if (hibaLista.length === 0) {
            return res.status(200).json({ message: "Nincs küldendő új activkom hiba." });
        }

        // 2. Végig megyünk a listán és egyenként küldjük
        let sikeresKuldések = 0;
        for (const hiba of hibaLista) {
            const siker = await sendNotificationEmail(hiba);

            if (siker) {
                // Csak akkor állítjuk át a státuszt, ha az email tényleg elment
                hiba.status = 'elkuldott';
                await hiba.save();
                sikeresKuldések++;
            }
            console.log("Sikeres küldés");
        }

        res.status(200).send(`Folyamat kész. Talált hibák: ${hibaLista.length}, Sikeresen elküldve: ${sikeresKuldések}`);

    } catch (error) {
        console.error("Hiba a /send endpointon:", error);
        res.status(500).send("Szerverhiba történt.");
    }
}

// --- EXPRESS VÉGPONTOK ---

// Manuális vagy automatikus trigger
app.get('/trigger', async (req, res) => {
    await startConsumer();
    res.status(200).send("A feldolgozó felébresztve, a sor ellenőrzése zajlik.");
});

// Új endpoint: GET /send
app.get('/send', async (req, res) => {
    await sendMail(res);
});

// Health check a Render számára
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", consuming: isConsuming });
});

app.listen(PORT, () => {
    console.log(`🚀 Consumer Web Service fut a ${PORT} porton.`);
    // Induláskor is ránézünk a sorra
    startConsumer();
});