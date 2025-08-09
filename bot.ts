import { GatewayIntentBits, Client, Events, Message, SendableChannels } from 'discord.js'
import dotenv from 'dotenv'
import fs from "fs"
import cron from "node-cron"
import { Log } from './log-type'
import { GenResponse } from './gemini'

dotenv.config()

const TOKEN = process.env.BOT_TOKEN
const TITLE = process.env.TITLE
const TITLE_ENGLISH = process.env.TITLE_ENGLISH
const GUILD = process.env.GUILD
const CHANNEL = process.env.CHANNEL

const PROMPT = fs.readFileSync("./prompt.txt", "utf8")
const PROMPT_ENGLISH = fs.readFileSync("./prompt_english.txt", "utf8")

if (!TITLE) { throw Error("title is not defined.")}
if (!GUILD || !CHANNEL) { throw Error("guild or channel is not defined.")}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

client.once(Events.ClientReady, c => {
	console.log(`${c.user.tag}でログインしました。`);
});

client.login(TOKEN);

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.guild?.id != GUILD) { return } //対象のサーバー以外を無視
    if (message.author.bot) return //bot自身の発言を無視
	if (message.system) return //システムメッセージを無視

    recordMessage(message)
})

cron.schedule("0 20 * * 0", async () => { //毎週日曜20:00
    await writeReport()
})

const recordMessage = (message: Message) => {
    if (message.channel.isDMBased()) { return }

    const data = fs.readFileSync("./log.json", "utf-8")
    const json: Log = JSON.parse(data)

    const channelID = message.channelId
    const channelLog = json.find(c => c.id == channelID)

    const messageData = { //記録するメッセージの情報
        user: message.author.username,
        content: message.content.replace(/\n/g, " "), //改行を消す
        date: message.createdAt.toISOString()
    }

    if (channelLog) { //既にチャンネル記録が存在するとき
        channelLog.messages.push(messageData)
    } else {
        json.push({
            id: channelID,
            name: message.channel.name,
            messages: [messageData]
        })
    }

    fs.writeFileSync("./log.json", JSON.stringify(json))
}

const formatLog = (json: Log, start: Date) => {
    const days = ["日", "月", "火", "水", "木", "金", "土"]

    const filtered = json.map(c => {
        c.messages = c.messages.filter(m => new Date(m.date).getTime() >= start.getTime())
        return c
    }).filter(c => c.messages.length > 0) //新規メッセージがあったものだけ抽出

    const channels = filtered.map(c => 
        `「${c.name}」チャンネル\n` +
        c.messages.map(m => {
            const date = new Date(m.date)
            return `${m.content} --${date.toLocaleDateString()} (${days[date.getDay()]}) ${date.toLocaleTimeString()}`
        }).join("\n")
    )

    return channels.join("\n\n")
}

const nameUpdate = async (log: Log) => {
    return await Promise.all(log.map(async (c) => {
        let channelName = ""
        
        try {
            const channel = await client.channels.fetch(c.id) //discordから最新のチャンネル情報を取得

            channelName = (() => { //無名関数をその場で実行（場合分けを楽にするため）
                if (!channel) { return c.name }
                if (channel.isDMBased()) { return c.name } //名前が取得できないときは現行の名前を返す
                return channel.name
            })()
        } catch (e) {
            channelName = c.name
        }

        c.name = channelName
        return c
    }))
}

const writeReport = async () => {
    const data = fs.readFileSync("./log.json", "utf-8")
    const json: Log = JSON.parse(data)

    const updated: Log = await nameUpdate(json) //チャンネル名の更新処理
    fs.writeFileSync("./log.json", JSON.stringify(updated))

    const nowDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7) //7日戻す

    fs.writeFileSync("./formatLog.txt", formatLog(updated, startDate))
    
    console.log("執筆中…")

    const channel = client.channels.cache.get(CHANNEL) //送信するチャンネル
    if (!channel) { return } //存在しなければ終了
    if (!channel.isSendable()) { return }

    const report = await GenResponse(PROMPT)
    fs.writeFileSync("./output.txt", report)

    const title = `## ${TITLE} ${startDate.toLocaleDateString()}～${nowDate.toLocaleDateString()}`
    const content = title + `\n\n` + report
    await sendReport(content, channel)

    const reportEnglish = await GenResponse(PROMPT_ENGLISH, "./output.txt") //英語版を執筆
    fs.writeFileSync("./output_english.txt", reportEnglish)

    const messageFetch = (await channel.messages.fetch({limit: 1})) //最後のメッセージ（botの日本語版レポートを取得）
    const latestMessage = Array.from(messageFetch)[0][1] //最後のメッセージ本体
    const englishThread = await latestMessage.startThread({ //そこにスレッドを作成
        name: `${TITLE_ENGLISH} (English Version)`,
        autoArchiveDuration: 60
    })
    
    const titleEnglish = `## ${TITLE_ENGLISH} ${startDate.toLocaleDateString()}～${nowDate.toLocaleDateString()}`
    const contentEnglish = titleEnglish + `\n\n` + reportEnglish
    await sendReport(contentEnglish, englishThread)
}

const sendReport = async (content: string, channel: SendableChannels) => {
    const chunkSize = 1900
    for (let pos = 0; pos < content.length; pos += chunkSize) {
        await channel.send(content.slice(pos, pos + chunkSize))
    }
}