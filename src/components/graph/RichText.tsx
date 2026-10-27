import { Block, Span } from "@/lib/richText";

function Spans({ spans }: { spans: Span[] }) {
  return spans.map((s, i) => {
    let node: React.ReactNode = s.text;
    if (s.bold) node = <strong className="font-semibold text-white/70">{node}</strong>;
    if (s.italic) node = <em>{node}</em>;
    return <span key={i}>{node}</span>;
  });
}

// A paragraph that is entirely italic is almost always a pulled quote
function isQuote(block: Block): boolean {
  return block.kind === "quote" || block.spans.every((s) => s.italic);
}

export default function RichText({ blocks, className = "" }: { blocks: Block[]; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((block, i) =>
        isQuote(block) ? (
          <blockquote key={i} className="border-l-2 border-violet-400/30 pl-3 italic text-white/45">
            <Spans spans={block.spans.map((s) => ({ ...s, italic: false }))} />
          </blockquote>
        ) : (
          <p key={i}>
            <Spans spans={block.spans} />
          </p>
        )
      )}
    </div>
  );
}
