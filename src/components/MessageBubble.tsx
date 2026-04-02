'use client';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Basic formatting: preserve newlines and handle **bold** / `code`
  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Replace **bold** markers
      const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
      const formatted = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={j} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={j}
              className="bg-black/10 rounded px-1 py-0.5 text-sm font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      return (
        <span key={i}>
          {formatted}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {formatContent(content)}
      </div>
    </div>
  );
}
