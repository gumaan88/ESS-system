import { GoogleGenAI } from "@google/genai";

// Safely access API Key
// @ts-ignore
const env = (import.meta && import.meta.env) ? import.meta.env : {};
const apiKey = env.VITE_GEMINI_API_KEY;

// Initialize with a fallback to prevent crash on init, but handle missing key in calls
const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

export const analyzeRequestJustification = async (justification: string): Promise<string> => {
    if (!apiKey) {
        return "خدمة الذكاء الاصطناعي غير متوفرة حالياً (مفتاح API مفقود).";
    }

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
        throw new Error("فشل في الحصول على تحليل من مساعد الذكاء الاصطناعي.");
    }
};