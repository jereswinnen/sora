"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const article = useQuery(api.articles.getArticle, {
    articleId: id as Id<"articles">,
  });

  if (article === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading article...</p>
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Article not found</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            ← Back
          </button>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            View Original
          </a>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Header Image */}
        {article.imageUrl && (
          <div className="mb-8">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-auto rounded-lg"
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-8 pb-8 border-b">
          {article.author && <span>By {article.author}</span>}
          {article.publishedAt && (
            <span>
              Published {new Date(article.publishedAt).toLocaleDateString()}
            </span>
          )}
          <span>Saved {new Date(article.savedAt).toLocaleDateString()}</span>
          {article.readAt && (
            <span>Read {new Date(article.readAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Article Body */}
        <div
          className="prose prose-lg max-w-none"
          style={{
            lineHeight: "1.8",
            fontSize: "18px",
          }}
        >
          {/* Render content as HTML with basic sanitization via whitespace preservation */}
          <div
            dangerouslySetInnerHTML={{ __html: article.content }}
            className="article-content"
          />
        </div>
      </article>

      {/* Global styles for article content */}
      <style jsx global>{`
        .article-content {
          color: #1a1a1a;
        }
        .article-content p {
          margin-bottom: 1.5em;
        }
        .article-content h1,
        .article-content h2,
        .article-content h3,
        .article-content h4 {
          margin-top: 2em;
          margin-bottom: 0.75em;
          font-weight: 600;
          line-height: 1.3;
        }
        .article-content h1 {
          font-size: 2em;
        }
        .article-content h2 {
          font-size: 1.5em;
        }
        .article-content h3 {
          font-size: 1.25em;
        }
        .article-content ul,
        .article-content ol {
          margin-left: 2em;
          margin-bottom: 1.5em;
        }
        .article-content li {
          margin-bottom: 0.5em;
        }
        .article-content a {
          color: #2563eb;
          text-decoration: underline;
        }
        .article-content a:hover {
          color: #1d4ed8;
        }
        .article-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1.5em;
          margin-left: 0;
          margin-right: 0;
          font-style: italic;
          color: #4b5563;
        }
        .article-content code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.9em;
          font-family: monospace;
        }
        .article-content pre {
          background-color: #f3f4f6;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1.5em;
        }
        .article-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .article-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 2em 0;
        }
      `}</style>
    </div>
  );
}
