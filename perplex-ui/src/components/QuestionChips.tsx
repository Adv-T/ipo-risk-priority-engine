interface Props {
  suggestions: string[]
  onPick: (q: string) => void
}

export default function QuestionChips({ suggestions, onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((q, idx) => (
        <button
          key={idx}
          className="glass px-3 py-1 text-sm hover:bg-white/15"
          onClick={() => onPick(q)}
        >
          {q}
        </button>
      ))}
    </div>
  )
}


