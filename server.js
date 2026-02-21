const express = require('express');
const amqp = require('amqplib');
const mongoose = require('mongoose');

const app = express();

const PORT = 3400;
const CLOUDAMQP_URL = 'amqps://vpwdmwwi:5WAHg6cVzwB0duCEeznFHl_W0eqfyF27@cow.rmq2.cloudamqp.com/vpwdmwwi';
const EXCHANGE_NAME = 'email';
const QUEUE_NAME = 'hibajelentesek_sora';
const MONGO_URI = 'mongodb+srv://francsicsg_db_user:f0UBM8gnByvvfdax@cluster0.pnxpsjr.mongodb.net/contact?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log("🍃 MongoDB kapcsolat kész."))
    .catch(err => console.error("❌ MongoDB hiba:", err));

const ContactSchema = new mongoose.Schema({
    id: String,
    topic: String,
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

// --- EXPRESS VÉGPONTOK ---

// Manuális vagy automatikus trigger
app.get('/trigger', (req, res) => {
    startConsumer();
    res.status(200).send("A feldolgozó felébresztve, a sor ellenőrzése zajlik.");
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