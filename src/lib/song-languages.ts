export const SONG_LANGUAGES = ["hindi", "english"] as const
export type SongLanguage = (typeof SONG_LANGUAGES)[number]

export const LANGUAGE_LABEL = { hindi: "Hindi", english: "English", mixed: "Mixed" } as const
