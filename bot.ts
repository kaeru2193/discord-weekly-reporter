import { GatewayIntentBits, Client, Events, Message } from 'discord.js'
import dotenv from 'dotenv'
import fs from "fs"
import cron from "node-cron"
import { Log } from './log-type'
import { GenResponse } from './gemini'

dotenv.config()

const TOKEN = process.env.BOT_TOKEN
const TITLE = process.env.TITLE
const CHANNEL = process.env.CHANNEL

if (!TITLE) { throw Error("title is not defined.")}
if (!CHANNEL) { throw Error("channel is not defined.")}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

client.once(Events.ClientReady, c => {
	console.log(`${c.user.tag}でログインしました。`);
});

client.login(TOKEN);

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return //bot自身の発言を無視
	if (message.system) return //システムメッセージを無視

    recordMessage(message)
})

cron.schedule("0 20 * * 5", async () => { //毎週金曜20:00
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

const formatLog = (start: Date) => {
    const data = fs.readFileSync("./log.json", "utf-8")
    const json: Log = JSON.parse(data)

    const filtered = json.map(c => {
        c.messages = c.messages.filter(m => new Date(m.date).getTime() >= start.getTime())
        return c
    }).filter(c => c.messages.length > 0) //新規メッセージがあったものだけ抽出

    const channels = filtered.map(c =>
        `## 「${c.name}」チャンネルのログ\n` +
        c.messages.map(m =>
            `@${m.user}:${m.content} (${new Date(m.date).toLocaleString()})`
        ).join("\n")
    )

    return channels.join("\n\n")
}

const writeReport = async () => {
    const nowDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7) //7日戻す

    fs.writeFileSync("./formatLog.txt", formatLog(startDate))
    
    console.log("執筆中…")
    const report = await GenResponse()
    const title = `## ${TITLE} ${startDate.toLocaleDateString()}～${nowDate.toLocaleDateString()}`

    const channel = client.channels.cache.get(CHANNEL)
    if (!channel) { return } //存在しなければ終了
    if (!channel.isSendable()) { return }

    channel.send(title + `\n\n` + report)
    fs.writeFileSync("./output.txt", report)
}