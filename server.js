import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up OpenAI SDK to use Groq's free API
const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// The Master System Prompt containing all HOSA Rules
const SYSTEM_PROMPT = `You are a HOSA Medical Math exam writer. Generate EXTREMELY HARD, deep, multi-step word problems.
RULES:
1. ROUNDING: Convert before rounding. Round ONLY the final answer. 
2. Rounding decimals: Look to immediate right. >=5 round up, <=4 round down.
3. DEFAULT ROUNDING: Nearest WHOLE NUMBER unless the question specifically specifies otherwise (e.g., nearest tenth).
4. PEDIATRIC DOSAGE: Always round DOWN to avoid overdose, regardless of the decimal (e.g., 31.9 -> 31).
5. ZEROES: Decimal expressions <1 MUST have a leading zero (0.5). A whole number MUST NEVER have a trailing zero (5, not 5.0).
6. CONVERSIONS TO USE:
- 1 kg = 2.2 lbs
- 1 inch = 2.54 cm
- 1 tsp = 5 mL, 1 tbsp = 15 mL, 1 oz = 30 mL, 1 cup = 240 mL
- 1 mL = 15 gtts (drops), 1 drop = 0.0667 mL
- C = (F - 32) * 5/9 | F = (C * 9/5) + 32
- BSA (m2) = √([height(cm) x weight(kg)]/3600) or √([height(in) x weight(lb)]/3131)

You must output valid JSON in this exact format, with no markdown formatting outside the JSON:
{
  "questions": [
    {
      "question": "The complex multi-step word problem text...",
      "explanation": "Step-by-step math to prove the answer.",
      "final_answer": "The final numerical answer (just the number/formatted correctly)"
    }
  ]
}`;

app.post('/api/generate', async (req, res) => {
    const { category, count, description } = req.body;

    try {
        const response = await openai.chat.completions.create({
            model: "qwen/qwen3-32b", // Fast, highly capable free model on Groq
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Generate ${count} extremely difficult, multi-step questions for the category: "${category}" (${description}). Output ONLY JSON.` }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        const data = JSON.parse(response.choices[0].message.content);
        res.json(data);
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate questions." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
