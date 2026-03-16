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

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// ADDED RULE 8: No internal double quotes to prevent JSON breaking!
const SYSTEM_PROMPT = `You are a HOSA Medical Math exam writer. Generate EXTREMELY HARD, deep, multi-step word problems.
RULES:
1. ROUNDING: Convert before rounding. Round ONLY the final answer. 
2. Rounding decimals: Look to immediate right. >=5 round up, <=4 round down.
3. DEFAULT: Nearest WHOLE NUMBER unless specified.
4. PEDS DOSAGE: ALWAYS round DOWN to avoid overdose (e.g., 31.9 -> 31).
5. ZEROES: <1 MUST have leading zero (0.5). Whole numbers NEVER have trailing zero (5, not 5.0).
6. CONVERSIONS: 1kg=2.2lbs, 1in=2.54cm, 1tsp=5mL, 1tbsp=15mL, 1oz=30mL, 1cup=240mL, 1mL=15gtts.
7. Output MUST be perfectly formatted JSON.
8. CRITICAL: DO NOT use double quotes (") inside your questions or explanations. Use single quotes (') instead.

Output ONLY valid JSON in this exact format, with no other text:
{
  "questions": [
    {
      "question": "Multi-step word problem text here...",
      "explanation": "Brief math steps here...",
      "final_answer": "Final number here"
    }
  ]
}`;

app.post('/api/generate', async (req, res) => {
    const { category, count, description } = req.body;

    try {
        console.log(`\nGenerating ${count} Qs for ${category} using Qwen3-32b...`);
        
        const completion = await groq.chat.completions.create({
            model: "qwen/qwen3-32b",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Generate ${count} extremely difficult, multi-step questions for the category: "${category}" (${description}). Output ONLY JSON.` }
            ],
            temperature: 0.2,
            // REMOVED response_format TO PREVENT GROQ FROM BLOCKING THE REQUEST
        });

        const rawText = completion.choices[0]?.message?.content || "{}";
        
        // ROBUST JSON EXTRACTOR: Finds the JSON block even if the AI adds extra conversational text
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI did not return any JSON formatting.");
        }

        const cleanJsonString = jsonMatch[0];
        const data = JSON.parse(cleanJsonString);
        
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
