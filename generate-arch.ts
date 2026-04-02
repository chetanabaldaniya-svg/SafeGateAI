import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

async function generate() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: "A clean, modern, professional software architecture diagram for a security gate application. The diagram features interconnected nodes. On the left, a 'Frontend' node with a web browser and a security guard icon. In the center, a 'Backend' node with a server icon, database icon, and AI brain icon. On the right, a 'Resident' node with a mobile phone icon. At the top, 'External APIs' nodes with email and cloud security icons. Arrows connect the nodes showing data flow. Blue and slate color palette, technical blueprint style, high resolution, flat vector art style.",
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(publicDir, 'architecture.png'), Buffer.from(base64EncodeString, 'base64'));
        console.log('Image saved successfully.');
        return;
      }
    }
    console.log('No image data found in response.');
  } catch (error) {
    console.error('Error generating image:', error);
  }
}

generate();
