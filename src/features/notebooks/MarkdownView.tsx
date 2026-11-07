import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import { assetUrl } from "../../lib/semestraBridge";

type Props = {
  source: string;
  className?: string;
};

const components = {
  img({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
    if (!src) return null;
    // Remote and data URLs pass through; anything else is one of our own
    // files in <data folder>/assets.
    const remote = /^(https?:|data:|semestra-asset:)/i.test(src);
    return (
      <img
        src={remote ? src : assetUrl(src)}
        alt={alt ?? ""}
        title={title}
        loading="lazy"
      />
    );
  },
};

export function MarkdownView({ source, className }: Props) {
  return (
    <div className={`md-view ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
