import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize the official Groq SDK
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Master prompt for HOSA rules
const SYSTEM_PROMPT = `You are a HOSA Medical Math exam writer. Generate EXTREMELY HARD, deep, multi-step word problems.
RULES:
1. ROUNDING: Convert before rounding. Round ONLY the final answer. 
2. Rounding decimals: Look to immediate right. >=5 round up, <=4 round down.
3. DEFAULT: Nearest WHOLE NUMBER unless specified.
4. PEDS DOSAGE: ALWAYS round DOWN to avoid overdose (e.g., 31.9 -> 31).
5. ZEROES: <1 MUST have leading zero (0.5). Whole numbers NEVER have trailing zero (5, not 5.0).
6. CONVERSIONS: 1kg=2.2lbs, 1in=2.54cm, 1tsp=5mL, 1tbsp=15mL, 1oz=30mL, 1cup=240mL, 1mL=15gtts.
7. Output MUST be perfectly formatted JSON.

Output ONLY valid JSON in this format:
{
  "questions": [
    {
      "question": "Multi-step word problem...",
      "explanation": "Brief math steps...",
      "final_answer": "Final number"
    }
  ]
}`;

app.post('/api/generate', async (req, res) => {
    const { category, count, description } = req.body;

    try {
        console.log(`\nGenerating ${count} Qs for ${category} using Qwen3-32b...`);
        
        const completion = await groq.chat.completions.create({
            model: "qwen/qwen3-32b", // Using your specified Groq Qwen model
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Generate ${count} extremely difficult, multi-step questions for the category: "${category}" (${description}). Output ONLY JSON.` }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        let rawText = completion.choices[0]?.message?.content || "{}";
        
        // CLEANUP: Qwen sometimes outputs markdown around JSON. This removes it so the app doesn't crash.
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(rawText);
        console.log(`✅ Successfully generated questions for ${category}`);
        res.json(data);
        
    } catch (error) {
        console.error(`\n❌ API Error for ${category}:`);
        console.error(error.message || error);
        res.status(500).json({ error: error.message || "Failed to generate questions." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
