require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function testGeneration() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const testModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];

  for (const m of testModels) {
    try {
      console.log(`Testing generateContent with model "${m}"...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: ['Hello from Gemini! Please respond with a JSON object: {"status": "ok", "model": "' + m + '"}'],
        config: {
          responseMimeType: 'application/json'
        }
      });
      console.log(`🎉 SUCCESS with ${m}! Output:`);
      console.log(res.text);
      return m;
    } catch (err) {
      console.log(`❌ Model ${m} error:`, err.message);
    }
  }
}

testGeneration();
