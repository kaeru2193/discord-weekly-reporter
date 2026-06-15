export type Log = {
    id: string,
    name: string,
    isThread: boolean,
    messages: {
        user: string,
        content: string,
        date: string
    }[]
}[]