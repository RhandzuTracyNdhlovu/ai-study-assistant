
"use client";

import { useState } from "react";
import "./globals.css";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [topic, setTopic] = useState("");
const [flashcards, setFlashcards] = useState([]);
const [generatingCards, setGeneratingCards] = useState(false);
const [flashcardError, setFlashcardError] = useState("");
const [showAnswer, setShowAnswer] = useState(false);
const [currentCard, setCurrentCard] = useState(0);
const [quiz, setQuiz] = useState([]);
const [quizTopic, setQuizTopic] = useState("");
const [generatingQuiz, setGeneratingQuiz] = useState(false);
const [quizError, setQuizError] = useState("");
const [currentQuestion, setCurrentQuestion] = useState(0);
const [selectedAnswer, setSelectedAnswer] = useState("");
const [quizScore, setQuizScore] = useState(0);
const [quizSubmitted, setQuizSubmitted] = useState(false);
const [quizFinished, setQuizFinished] = useState(false);
const [quizResponses, setQuizResponses] = useState([]);

  async function uploadDocument() {
    if (!file) {
      setUploadError("Please select a PDF or DOCX document.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setUploadMessage(
  `${data.filename} uploaded and indexed successfully! ${data.total_chunks} chunks saved to your study database.`
   );
      setFile(null);

      const input = document.getElementById("document-upload");
      if (input) input.value = "";

    } catch (err) {
      setUploadError(err.message || "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function askAI() {
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

async function generateFlashcards() {
  if (!topic.trim()) {
    setFlashcardError("Please enter a study topic.");
    return;
  }

  setGeneratingCards(true);
  setFlashcardError("");
  setFlashcards([]);
  setCurrentCard(0);
  setShowAnswer(false);

  try {
    const response = await fetch("/api/flashcards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topic }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not generate flashcards.");
    }

    setFlashcards(data.flashcards || []);

  } catch (err) {
    setFlashcardError(
      err.message || "Unable to generate flashcards."
    );
  } finally {
    setGeneratingCards(false);
  }
}
async function generateQuiz() {
  if (!quizTopic.trim()) {
    setQuizError("Please enter a study topic.");
    return;
  }

  setGeneratingQuiz(true);
  setQuizError("");
  setQuiz([]);
  setCurrentQuestion(0);
  setSelectedAnswer("");
  setQuizScore(0);
  setQuizSubmitted(false);
  setQuizFinished(false);
  setQuizResponses([]);

  try {
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topic: quizTopic }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not generate quiz.");
    }

    setQuiz(data.questions || []);
  } catch (err) {
    setQuizError(err.message || "Unable to generate quiz.");
  } finally {
    setGeneratingQuiz(false);
  }
}


  return (
    <main>
      <nav className="navbar">
        <h2>AI Study Assistant</h2>
        <span>My Learning Space</span>
      </nav>

      <section className="welcome">
        <p className="tagline">
          YOUR PERSONAL LEARNING COMPANION
        </p>

        <h1>Learn smarter with AI.</h1>

        <p>
          Ask questions, explore your study materials
          and get helpful answers.
        </p>
      </section>

      <section className="question-box">
        <h2>Upload Your Study Documents</h2>

        <p>Select a PDF or Word document (.docx).</p>

        <input
          id="document-upload"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setUploadMessage("");
            setUploadError("");
          }}
        />

        {file && <p>Selected file: {file.name}</p>}

        <button
          onClick={uploadDocument}
          disabled={uploading || !file}
        >
          {uploading ? "Uploading..." : "Upload Document"}
        </button>

        {uploadMessage && <p>{uploadMessage}</p>}
        {uploadError && <p>{uploadError}</p>}
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

          {sources.length > 0 ? (
            sources.map((source, index) => (
              <div key={index}>
                <h3>
                  Source {index + 1} — Page {source.page_number}
                </h3>
                <p>{source.text}</p>
              </div>
            ))
          ) : (
            <p>No sources available.</p>
          )}
        </div>
      </section>

      <section className="question-box">
        <h2>Study with Flashcards</h2>

        <p>Generate flashcards from your uploaded study materials.</p>

        <input
          type="text"
          placeholder="Enter a topic, e.g. BitLocker"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <button
          onClick={generateFlashcards}
          disabled={generatingCards}
        >
          {generatingCards ? "Generating..." : "Generate Flashcards"}
        </button>

        {flashcardError && <p>{flashcardError}</p>}

        {flashcards.length > 0 && (
          <div className="answer-box">
            <h3>Flashcard {currentCard + 1} of {flashcards.length}</h3>

            <div>
              <h3>{flashcards[currentCard].question}</h3>

              {showAnswer && (
                <p>{flashcards[currentCard].answer}</p>
              )}
            </div>

            <button onClick={() => setShowAnswer(!showAnswer)}>
              {showAnswer ? "Hide Answer" : "Reveal Answer"}
            </button>

            <button
              disabled={currentCard === 0}
              onClick={() => {
                setCurrentCard(currentCard - 1);
                setShowAnswer(false);
              }}
            >
              Previous
            </button>

            <button
              disabled={currentCard === flashcards.length - 1}
              onClick={() => {
                setCurrentCard(currentCard + 1);
                setShowAnswer(false);
              }}
            >
              Next
            </button>
          </div>
        )}
      </section>

      <section className="question-box">
        <h2>Practice Quiz</h2>

        <p>Test your knowledge with questions from your study materials.</p>

        <input
          type="text"
          placeholder="Enter a study topic, e.g. BitLocker"
          value={quizTopic}
          onChange={(e) => setQuizTopic(e.target.value)}
        />

        <button
          onClick={generateQuiz}
          disabled={generatingQuiz}
        >
          {generatingQuiz ? "Generating Quiz..." : "Generate Practice Quiz"}
        </button>

      
        {quizError && <p>{quizError}</p>}

        {quiz.length > 0 && !quizFinished && (
          <div className="answer-box">
            <h3>
              Question {currentQuestion + 1} of {quiz.length}
            </h3>

            <h3>{quiz[currentQuestion].question}</h3>

            {quiz[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                disabled={quizSubmitted}
                onClick={() => {
                  setSelectedAnswer(option);
                  setQuizResponses((previous) => {
                    const updated = [...previous];
                    updated[currentQuestion] = {
                      selectedAnswer: option,
                      submitted: false,
                    };
                    return updated;
                  });
                }}
              >
                {option}
                {selectedAnswer === option ? " ✓" : ""}
              </button>
            ))}

            {!quizSubmitted ? (
              <button
                disabled={!selectedAnswer}
                onClick={() => {
                  setQuizResponses((previous) => {
                    const updated = [...previous];
                    updated[currentQuestion] = {
                      selectedAnswer,
                      submitted: true,
                    };
                    return updated;
                  });
                  setQuizSubmitted(true);
                }}
              >
                Submit Answer
              </button>
            ) : (
              <p>
                {selectedAnswer === quiz[currentQuestion].correctAnswer
                  ? "Correct! Well done."
                  : `Incorrect. Correct answer: ${quiz[currentQuestion].correctAnswer}`}
              </p>
            )}

            <button
              disabled={currentQuestion === 0}
              onClick={() => {
                const previousQuestion = currentQuestion - 1;
                const response = quizResponses[previousQuestion] || {};

                setCurrentQuestion(previousQuestion);
                setSelectedAnswer(response.selectedAnswer || "");
                setQuizSubmitted(!!response.submitted);
              }}
            >
              Previous
            </button>

            {quizSubmitted && (
              <button
                onClick={() => {
                  if (currentQuestion === quiz.length - 1) {
                    setQuizScore(
                      quizResponses.filter(
                        (response, index) =>
                          response?.submitted &&
                          response.selectedAnswer === quiz[index].correctAnswer
                      ).length
                    );
                    setQuizFinished(true);
                  } else {
                    const nextQuestion = currentQuestion + 1;
                    const response = quizResponses[nextQuestion] || {};

                    setCurrentQuestion(nextQuestion);
                    setSelectedAnswer(response.selectedAnswer || "");
                    setQuizSubmitted(!!response.submitted);
                  }
                }}
              >
                {currentQuestion === quiz.length - 1
                  ? "Finish Quiz"
                  : "Next Question"}
              </button>
            )}
          </div>
        )}

        {quizFinished && (
          <div className="answer-box">
            <h3>Quiz Completed!</h3>
            <h2>Your Score: {quizScore} / {quiz.length}</h2>
            <button onClick={generateQuiz}>
              Try Again
            </button>
          </div>
        )}

      </section>

      <footer>
        AI Study Assistant © 2026
      </footer>
    </main>
  );
}
