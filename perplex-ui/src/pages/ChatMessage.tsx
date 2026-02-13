// ChatMessage.tsx — with Markdown rendering

import ReactMarkdown from "react-markdown";

export default function ChatMessage({ msg }: any) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl border ${
          isUser
            ? "bg-white text-black border-white"
            : "bg-neutral-800 text-white border-white/10"
        }`}
      >
        <ReactMarkdown className="prose prose-invert prose-sm">
          {msg.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
