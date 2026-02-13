import type { ChatMessage as Msg } from '../lib/types'

export default function ChatMessage({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl border ${isUser ? 'bg-white/20 border-white/20' : 'bg-white/10 border-white/15'} `}>
        <p className="whitespace-pre-wrap leading-relaxed text-white/90">{msg.content}</p>
      </div>
    </div>
  )
}


