// Zero-dependency local backend for the Examly demo (Node 22.5+).
// It serves the UI and persists exam attempts to the SQLite file examly.db.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.argv[2] || 3000);
const ROOT = __dirname;
const db = new DatabaseSync(path.join(ROOT, 'examly.db'));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, roll_number TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY, course_code TEXT NOT NULL, title TEXT NOT NULL, duration_minutes INTEGER NOT NULL, total_marks INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, exam_id INTEGER NOT NULL REFERENCES exams(id), question_text TEXT NOT NULL, marks REAL NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS options (id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id), option_index INTEGER NOT NULL, option_text TEXT NOT NULL, is_correct INTEGER NOT NULL DEFAULT 0, UNIQUE(question_id, option_index));
  CREATE TABLE IF NOT EXISTS exam_attempts (id INTEGER PRIMARY KEY, exam_id INTEGER NOT NULL REFERENCES exams(id), student_id INTEGER NOT NULL REFERENCES students(id), started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, submitted_at TEXT, status TEXT NOT NULL DEFAULT 'In Progress' CHECK(status IN ('In Progress', 'Submitted')), score REAL, UNIQUE(exam_id, student_id));
  CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY, attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE, question_id INTEGER NOT NULL REFERENCES questions(id), option_id INTEGER NOT NULL REFERENCES options(id), saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(attempt_id, question_id));
`);

const student = { id: 1, name: 'Aisha Sharma', rollNumber: 'BCA2023-041' };
db.prepare('INSERT OR IGNORE INTO students (id, name, roll_number) VALUES (?, ?, ?)').run(student.id, student.name, student.rollNumber);
db.prepare('INSERT OR IGNORE INTO exams (id, course_code, title, duration_minutes, total_marks) VALUES (1, ?, ?, 90, 50)').run('CS-304', 'Database Management Systems');

const seedQuestions = [
  ['Which SQL command is used to retrieve data from a database?', ['GET', 'SELECT', 'FETCH', 'EXTRACT'], 1],
  ['Which key uniquely identifies every record in a table?', ['Foreign key', 'Composite key', 'Primary key', 'Candidate field'], 2],
  ['Which normal form removes partial dependencies?', ['First normal form', 'Second normal form', 'Third normal form', 'BCNF'], 1],
  ['A relation in a database is best described as a:', ['Column', 'Table', 'Query', 'Constraint'], 1],
  ['Which clause filters grouped records in SQL?', ['WHERE', 'ORDER BY', 'HAVING', 'DISTINCT'], 2],
  ['What does a foreign key enforce?', ['Sorting', 'Referential integrity', 'Data encryption', 'Data duplication'], 1],
  ['Which JOIN returns rows with matching values in both tables?', ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN'], 2],
  ['Which command permanently saves a transaction?', ['SAVE', 'COMMIT', 'LOCK', 'GRANT'], 1],
  ['An attribute that can hold multiple values is called:', ['Derived', 'Simple', 'Multivalued', 'Composite'], 2],
  ['Which SQL operation combines result sets and removes duplicates?', ['JOIN', 'UNION', 'MERGE', 'GROUP BY'], 1]
];
if (db.prepare('SELECT COUNT(*) AS total FROM questions WHERE exam_id = 1').get().total === 0) {
  const addQuestion = db.prepare('INSERT INTO questions (exam_id, question_text, marks) VALUES (1, ?, 5)');
  const addOption = db.prepare('INSERT INTO options (question_id, option_index, option_text, is_correct) VALUES (?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const [text, options, answer] of seedQuestions) {
      const question = addQuestion.run(text);
      options.forEach((option, index) => addOption.run(question.lastInsertRowid, index, option, Number(index === answer)));
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
db.prepare('UPDATE questions SET marks = 5 WHERE exam_id = 1').run();

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  try { return body ? JSON.parse(body) : {}; } catch { throw new Error('Request body must be valid JSON.'); }
}

function getAttempt() {
  return db.prepare(`SELECT a.id, a.status, a.score, a.started_at AS startedAt, a.submitted_at AS submittedAt,
    COUNT(r.id) AS answered FROM exam_attempts a LEFT JOIN responses r ON r.attempt_id = a.id
    WHERE a.exam_id = 1 AND a.student_id = ? GROUP BY a.id`).get(student.id);
}

async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/exams/1/attempt') return json(response, 200, { attempt: getAttempt() || null });
  if (request.method === 'POST' && url.pathname === '/api/exams/1/attempt') {
    const existing = getAttempt();
    if (existing?.status === 'Submitted') return json(response, 409, { message: 'This exam has already been submitted.', attempt: existing });
    if (existing) return json(response, 200, { attempt: existing });
    const result = db.prepare('INSERT INTO exam_attempts (exam_id, student_id) VALUES (1, ?)').run(student.id);
    return json(response, 201, { attempt: { id: Number(result.lastInsertRowid), status: 'In Progress', answered: 0 } });
  }
  const responseMatch = url.pathname.match(/^\/api\/attempts\/(\d+)\/responses$/);
  if (request.method === 'PUT' && responseMatch) {
    const attemptId = Number(responseMatch[1]);
    const { questionNumber, optionIndex } = await readJson(request);
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(attemptId, student.id);
    if (!attempt) return json(response, 404, { message: 'Exam attempt not found.' });
    if (attempt.status !== 'In Progress') return json(response, 409, { message: 'Submitted exams cannot be changed.' });
    const question = db.prepare('SELECT id FROM questions WHERE exam_id = 1 ORDER BY id LIMIT 1 OFFSET ?').get(Number(questionNumber) - 1);
    const option = question && db.prepare('SELECT id FROM options WHERE question_id = ? AND option_index = ?').get(question.id, Number(optionIndex));
    if (!option) return json(response, 400, { message: 'Invalid question or answer.' });
    db.prepare(`INSERT INTO responses (attempt_id, question_id, option_id) VALUES (?, ?, ?)
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET option_id = excluded.option_id, saved_at = CURRENT_TIMESTAMP`).run(attemptId, question.id, option.id);
    return json(response, 200, { saved: true });
  }
  const submitMatch = url.pathname.match(/^\/api\/attempts\/(\d+)\/submit$/);
  if (request.method === 'POST' && submitMatch) {
    const attemptId = Number(submitMatch[1]);
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(attemptId, student.id);
    if (!attempt) return json(response, 404, { message: 'Exam attempt not found.' });
    if (attempt.status === 'Submitted') return json(response, 409, { message: 'This exam is already submitted.' });
    const score = db.prepare(`SELECT COALESCE(SUM(q.marks), 0) AS score FROM responses r
      JOIN options o ON o.id = r.option_id AND o.is_correct = 1
      JOIN questions q ON q.id = r.question_id WHERE r.attempt_id = ?`).get(attemptId).score;
    db.prepare("UPDATE exam_attempts SET status = 'Submitted', submitted_at = CURRENT_TIMESTAMP, score = ? WHERE id = ?").run(score, attemptId);
    return json(response, 200, { attempt: getAttempt() });
  }
  return json(response, 404, { message: 'API route not found.' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.sql': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(request, response, url);
    const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(ROOT, relativePath);
    if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { response.writeHead(404); return response.end('Not found'); }
    response.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) { json(response, 500, { message: error.message }); }
});
server.listen(PORT, () => console.log(`Examly is running at http://localhost:${PORT}`));
