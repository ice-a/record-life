import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
  img: ({ alt, ...props }) => <img {...props} alt={alt || ''} loading="lazy" />,
  table: (props) => (
    <div className="markdown-table-wrap">
      <table {...props} />
    </div>
  ),
};

export function MarkdownContent({ source, fallback = '没有可展示内容。', className = '' }) {
  const markdown = String(source || '').trim();

  if (!markdown) {
    return (
      <div className={`markdown-body markdown-body-empty ${className}`}>
        <p>{fallback}</p>
      </div>
    );
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
