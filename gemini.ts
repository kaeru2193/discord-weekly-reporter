import "dotenv/config"
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import fs from "fs"

const APIKEY = process.env.API_KEY
const MODEL = process.env.MODEL
if (!APIKEY) { throw Error("API KEY is not defined.") }
if (!MODEL) { throw Error("MODEL is not defined.") }

const PROMPT = fs.readFileSync("./prompt.txt", "utf8")

const genAI = new GoogleGenAI({ apiKey: APIKEY })

export const GenResponse = async () => {
    const logFile = await genAI.files.upload({
        file: "./formatLog.txt"
    })
    if (!logFile.uri || !logFile.mimeType) { throw Error("this file has not been uploaded.") }

    const res = await genAI.models.generateContent({
        model: MODEL,
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