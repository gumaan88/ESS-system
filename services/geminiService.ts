import { GoogleGenAI } from "@google/genai";

// Always use process.env.API_KEY as per Google GenAI SDK guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeRequestJustification = async (justification: string): Promise<string> => {
    try {
        const prompt = `
            You are an expert HR assistant. Analyze the following justification for an employee request. 
            Provide a brief, constructive, one-sentence suggestion to make it stronger or clearer. 
            If it's already good, simply state that it is clear and well-justified.
            The response must be in Arabic.

            Justification: "${justification}"

            Your suggestion:
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        const text = response.text;
        if (!text) {
             throw new Error("No response text from Gemini.");
        }
        return text.trim();
    } catch (error) {
        console.error("Error analyzing justification with Gemini:", error);
        return "حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي.";
    }
};