import "dotenv/config"
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import fs from "fs"

const APIKEY = process.env.API_KEY
const PROMPT = process.env.PROMPT
if (!APIKEY) { throw Error("API KEY is not defined.") }
if (!PROMPT) { throw Error("PROMPT is not defined.") }

const genAI = new GoogleGenAI({ apiKey: APIKEY })

export const GenResponse = async () => {
    const logFile = await genAI.files.upload({
        file: "./formatLog.txt"
    })
    if (!logFile.uri || !logFile.mimeType) { throw Error("this file has not been uploaded.") }

    const res = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: createUserContent([
            createPartFromUri(logFile.uri, logFile.mimeType),
            "\n\n",
            PROMPT
        ])
    })

    const text = res.text

    if (text) {
        return text
    } else {
        return "エラー！"
    }
}