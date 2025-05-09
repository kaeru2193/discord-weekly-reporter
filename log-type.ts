export type Log = {
    id: string,
    name: string,
    messages: {
        user: string,
        content: string,
        date: string
    }[]
}[]