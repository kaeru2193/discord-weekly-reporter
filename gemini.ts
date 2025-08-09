import "dotenv/config"
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import fs from "fs"

const APIKEY = process.env.API_KEY
const MODEL = process.env.MODEL
if (!APIKEY) { throw Error("API KEY is not defined.") }
if (!MODEL) { throw Error("MODEL is not defined.") }

const genAI = new GoogleGenAI({ apiKey: APIKEY })

export const GenResponse = async (prompt: string, refer?: string) => {
    const logFile = await genAI.files.upload({
        file: "./formatLog.txt"
    })
    if (!logFile.uri || !logFile.mimeType) { throw Error("this file has not been uploaded.") }

    let referFile = null
    if (refer) {
        referFile = await genAI.files.upload({
            file: refer
        })
        if (!referFile.uri || !referFile.mimeType) { throw Error("this file has not been uploaded.") }
    }

    const res = await genAI.models.generateContent({
        model: MODEL,
        contents: createUserContent([
            createPartFromUri(logFile.uri, logFile.mimeType),
            ...(referFile
                ? ["\n\n", createPartFromUri(referFile.uri as string, referFile.mimeType as string), "\n\n"]
                : ["\n\n"]),
            prompt
        ])
    })

    const text = res.text

    if (text) {
        return text
    } else {
        return "エラー！"
    }
}