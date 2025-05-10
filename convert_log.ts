import fs from "fs"
import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"

const log = fs.readFileSync("./langloun.csv", "utf-8")

const arr: any[] = parse(log, { columns: true })

const processed = arr.map(m => {
    const message = {
        User: m.Author,
        Message: m.Content.replace(/\n/g, " "),
        Date: new Date(m.Date).toLocaleString()
    }
    return `${message.Message} (${message.Date} @${message.User})`
})

//const output = stringify(processed, { header: true })
fs.writeFileSync("./formatLog.txt", processed.join("\n"))