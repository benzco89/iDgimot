const { GoogleGenAI } = require('@google/genai');

async function test() {
    console.log('Testing SDK...');
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = 'gemini-2.5-flash'; // Use a stable model for testing structure

        const result = await ai.models.generateContentStream({
            model,
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        });

        for await (const chunk of result) {
            console.log('Chunk keys:', Object.keys(chunk));
            console.log('Type of text:', typeof chunk.text);
            if (typeof chunk.text === 'function') {
                console.log('text() result:', chunk.text());
            } else {
                console.log('text value:', chunk.text);
            }
            break; // Just check the first chunk
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
