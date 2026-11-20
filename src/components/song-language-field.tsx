import { LANGUAGE_LABEL, SONG_LANGUAGES, type SongLanguage } from "@/lib/song-languages"

export function SongLanguageField({ value, onChange }: {
  value?: string | null
  onChange?: (value: SongLanguage | null) => void
}) {
  const selection = onChange ? { value: value ?? "" } : { defaultValue: value ?? "" }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">Language</span>
      <select name="language" className="field" {...selection} onChange={onChange
        ? (event) => {
          const next = SONG_LANGUAGES.find((language) => language === event.target.value)
          onChange(next ?? null)
        }
        : undefined}>
        <option value="">Untagged</option>
        {SONG_LANGUAGES.map((language) => <option key={language} value={language}>{LANGUAGE_LABEL[language]}</option>)}
      </select>
    </label>
  )
}
