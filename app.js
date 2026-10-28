const questions = [
  { text: "Which SQL command is used to retrieve data from a database?", options: ["GET", "SELECT", "FETCH", "EXTRACT"] },
  { text: "Which key uniquely identifies every record in a table?", options: ["Foreign key", "Composite key", "Primary key", "Candidate field"] },
  { text: "Which normal form removes partial dependencies?", options: ["First normal form", "Second normal form", "Third normal form", "BCNF"] },
  { text: "A relation in a database is best described as a:", options: ["Column", "Table", "Query", "Constraint"] },
  { text: "Which clause filters grouped records in SQL?", options: ["WHERE", "ORDER BY", "HAVING", "DISTINCT"] },
  { text: "What does a foreign key enforce?", options: ["Sorting", "Referential integrity", "Data encryption", "Data duplication"] },
  { text: "Which JOIN returns rows with matching values in both tables?", options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN"] },
  { text: "Which command permanently saves a transaction?", options: ["SAVE", "COMMIT", "LOCK", "GRANT"] },
  { text: "An attribute that can hold multiple values is called:", options: ["Derived", "Simple", "Multivalued", "Composite"] },
  { text: "Which SQL operation combines result sets and removes duplicates?", options: ["JOIN", "UNION", "MERGE", "GROUP BY"] }
];

let currentQuestion = 0;
const answers = Array(questions.length).fill(null);
let examSeconds = 90 * 60;
let timerId;
let attemptId = null;
let submitted = false;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || "Something went wrong."), { status: response.status, body });
  return body;
}

function toast(message, error = false) {
  const element = $("#toast");
  element.textContent = message;
  element.style.background = error ? "#a7444e" : "#2d765b";
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 4000);
}

function setSubmitted(attempt) {
  submitted = true;
  attemptId = attempt?.id || attemptId;
  clearInterval(timerId);
  $("#startExam").disabled = true;
  $("#startExam").textContent = "Exam submitted ✓";
  const tableButton = $("#startExamTable");
  if (tableButton?.tagName === "BUTTON") tableButton.replaceWith(Object.assign(document.createElement("span"), { id: "startExamTable", className: "status", textContent: `Submitted${attempt?.score !== null && attempt?.score !== undefined ? ` · ${attempt.score}/50` : ""}` }));
  $("#examState").innerHTML = "<strong>Exam completed</strong> · Your submission has been saved";
}

async function loadAttempt() {
  try {
    const { attempt } = await request("/api/exams/1/attempt");
    if (!attempt) return;
    attemptId = attempt.id;
    if (attempt.status === "Submitted") setSubmitted(attempt);
    else {
      Object.entries(attempt.answers || {}).forEach(([questionNumber, optionIndex]) => { answers[Number(questionNumber) - 1] = Number(optionIndex); });
      toast(`You have an in-progress attempt with ${attempt.answered} saved answer${attempt.answered === 1 ? "" : "s"}.`);
    }
  } catch { toast("Start the project using npm start so the database is available.", true); }
}

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function renderQuestion() {
  const question = questions[currentQuestion];
  $("#questionNumber").textContent = currentQuestion + 1;
  $("#questionText").textContent = question.text;
  $("#answers").innerHTML = question.options.map((option, index) => `
    <label class="${answers[currentQuestion] === index ? "selected" : ""}">
      <input type="radio" name="answer" value="${index}" ${answers[currentQuestion] === index ? "checked" : ""}>
      <span>${String.fromCharCode(65 + index)}.</span> ${option}
    </label>`).join("");
  $$("#answers input").forEach(input => input.addEventListener("change", async event => {
    answers[currentQuestion] = Number(event.target.value);
    renderQuestion();
    try { await request(`/api/attempts/${attemptId}/responses`, { method: "PUT", body: JSON.stringify({ questionNumber: currentQuestion + 1, optionIndex: answers[currentQuestion] }) }); }
    catch (error) { toast(error.message, true); }
  }));
  $("#previousQuestion").style.visibility = currentQuestion === 0 ? "hidden" : "visible";
  $("#nextQuestion").textContent = currentQuestion === questions.length - 1 ? "Save answer" : "Save & next →";
  renderPalette();
}

function renderPalette() {
  $("#questionDots").innerHTML = questions.map((_, index) => `<button class="${index === currentQuestion ? "current" : ""} ${answers[index] !== null ? "answered" : ""}" data-index="${index}">${index + 1}</button>`).join("");
  $$("#questionDots button").forEach(button => button.addEventListener("click", () => { currentQuestion = Number(button.dataset.index); renderQuestion(); }));
}

async function openExam() {
  if (submitted) return toast("This exam was already submitted and cannot be started again.", true);
  try {
    const { attempt } = await request("/api/exams/1/attempt", { method: "POST" });
    attemptId = attempt.id;
    $("#examModal").classList.add("show");
    $("#examModal").setAttribute("aria-hidden", "false");
    renderQuestion();
    clearInterval(timerId);
    timerId = setInterval(() => {
      examSeconds = Math.max(0, examSeconds - 1);
      $("#examTimer").textContent = formatTime(examSeconds);
      if (!examSeconds) openSubmitDialog();
    }, 1000);
  } catch (error) {
    if (error.status === 409 && error.body.attempt) setSubmitted(error.body.attempt);
    toast(error.message, true);
  }
}

function openSubmitDialog() {
  $("#answeredCount").textContent = answers.filter(answer => answer !== null).length;
  $("#submitModal").classList.add("show");
}

function closeSubmitDialog() { $("#submitModal").classList.remove("show"); }

async function submitExam() {
  try {
    const { attempt } = await request(`/api/attempts/${attemptId}/submit`, { method: "POST" });
    $("#submitModal").classList.remove("show");
    $("#examModal").classList.remove("show");
    setSubmitted(attempt);
    toast("Your exam was submitted and saved to the database.");
  } catch (error) { toast(error.message, true); }
}

$("#startExam").addEventListener("click", openExam);
$("#startExamTable").addEventListener("click", openExam);
$("#nextQuestion").addEventListener("click", () => { if (currentQuestion < questions.length - 1) { currentQuestion += 1; renderQuestion(); } });
$("#previousQuestion").addEventListener("click", () => { if (currentQuestion > 0) { currentQuestion -= 1; renderQuestion(); } });
$("#finishExam").addEventListener("click", openSubmitDialog);
$("#reviewExam").addEventListener("click", closeSubmitDialog);
$("#confirmSubmit").addEventListener("click", submitExam);

$$('.nav a, a[href^="#"]').forEach(link => link.addEventListener("click", event => {
  const target = link.getAttribute("href");
  if (!target || !document.querySelector(target)) return;
  event.preventDefault();
  $$(".page").forEach(page => page.classList.remove("active-page"));
  $(target).classList.add("active-page");
  $$(".nav a").forEach(item => item.classList.toggle("active", item.getAttribute("href") === target));
  $(".sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}));

$(".mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

let dashboardSeconds = 1 * 3600 + 42 * 60 + 18;
setInterval(() => { dashboardSeconds = Math.max(0, dashboardSeconds - 1); $("#countdown").textContent = formatTime(dashboardSeconds); }, 1000);
loadAttempt();
