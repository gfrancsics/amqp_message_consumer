async function classifyError(description) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Feladatod egy hálózati hibajelentés besorolása.
            
            A válaszodban CSAK a kategória nevét használd az alábbi listából:
            - LASSU_INTERNET (ha lassú vagy nem éri el a sávszélességet)
            - KAPCSOLATI_HIBA (ha gyakran megszakad)
            - NINCS_INTERNET (ha egyáltalán nincs szolgáltatás)
            - EMAIL_HIBA (ha nem jönnek be a levelek)
            - FIX_IP_PROBLÉMA (ha a fix IP-vel van gond)
            - AUTH_HIBA (ha rossz a felhasználónév vagy jelszó)
            - BELSO_HALOZAT (helyi hálózati probléma)
            - FIZIKAI_SERULES (elszakadt kábel)
            - ARAMSZUNET (ha elment az áram)
            - EGYEB (ha nem illik bele a fentiekbe)

            A hiba leírása: "${description}"
            
            Válasz:`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini hiba:", error);
        return "BESOROLATLAN";
    }
}
const kategoria = await classifyError(data.description);
const ujHiba = new Hiba({
    ...data,
    category: kategoria, // Így később tudsz kategória alapján szűrni
    aiSummary: await aiAnalyze(data.description) // Az összefoglaló is mehet a DB-be
});
await ujHiba.save();

// A Nodemailer küldésnél:
const mailOptions = {
    from: `"Hibafigyelő AI" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `🚨 [${kategoria}] Új hibabejelentés`, // A tárgyban ott lesz a kategória!
    html: `
        <h3>Intelligens hiba-elemzés:</h3>
        <p><strong>Besorolt kategória:</strong> ${kategoria}</p>
        <hr>
        <p><strong>Eredeti leírás:</strong> ${data.description}</p>
    `
};
