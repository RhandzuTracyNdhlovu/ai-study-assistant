
"use client";

import { useState } from "react";
import "./globals.css";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askAI() {
     console.log("ASK AI BUTTON CLICKED");
    if (!question.trim()) {
      setError("Please enter a question first.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]); 

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      console.log("API RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch (err) {
      setError(err.message || "Unable to get results.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <nav className="navbar">
        <h2>AI Study Assistant</h2>
        <span>My Learning Space</span>
      </nav>

      <section className="welcome">
        <p className="tagline">YOUR PERSONAL LEARNING COMPANION</p>
        <h1>Learn smarter with AI.</h1>
        <p>
          Ask questions, explore your study materials
          and get helpful answers.
        </p>
      </section>

      <section className="question-box">
        <h2>What would you like to learn today?</h2>

        <textarea
          placeholder="Ask a question about your study materials..."
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button onClick={askAI} disabled={loading}>
          {loading ? "Searching..." : "Ask AI →"}
        </button>

        <p className="hint">
          Your AI assistant is ready to help you learn.
        </p>
      </section>

      <section className="answer-box">
        <h2>AI Answer</h2>

        {loading && <p>Searching your study materials...</p>}
        {error && <p>{error}</p>}

       {!loading && !error && !answer && (
  <p>Your answers will appear here.</p>
)}

  <div>
  <h2>Answer</h2>
  <p>{answer}</p>

  <hr />

  <h2>Sources</h2>

  {sources && sources.length > 0 ? (
    sources.map((source, index) => (
      <div key={index}>
        <h3>Source {index + 1} — Page {source.page_number}</h3>
        <p>{source.text}</p>
      </div>
    ))
  ) : (
    <p>No sources available.</p>
  )}
</div>
      </section>

      <footer>
        AI Study Assistant © 2026
      </footer>
    </main>
  );
}
