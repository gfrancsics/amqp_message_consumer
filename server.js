const express = require('express');
const amqp = require('amqplib');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// --- MONGODB BEÁLLÍTÁS ---
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("🍃 MongoDB kapcsolat kész."))
    .catch(err => console.error("❌ MongoDB hiba:", err));

const HibaSchema = new mongoose.Schema({
    email: String,
    topic: String,
    description: String,
    urgent: Boolean,
    timestamp: { type: Date, default: Date.now }
});
const Hiba = mongoose.model('Hiba', HibaSchema);

// --- RABBITMQ CONSUMER LOGIKA ---
let isConsuming = false;

async function startConsumer() {
    if (isConsuming) return; // Ne indítsuk el többször

    try {
        const connection = await amqp.connect(process.env.CLOUDAMQP_URL);
        const channel = await connection.createChannel();

        const QUEUE_NAME = 'hibajelentesek_fix_sora';
        const EXCHANGE_NAME = 'email';

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

                    const ujHiba = new Hiba(data);
                    await ujHiba.save();

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