
export default function Home() {
  return (
    <main>
      <h1>AI Study Assistant</h1>
      <p>Your personal AI-powered learning companion.</p>

      <section>
        <h2>Ask a question</h2>
        <textarea
          placeholder="Type your study question here..."
          rows={5}
        />
        <br />
        <button>Ask AI</button>
      </section>
    </main>
  );
}
