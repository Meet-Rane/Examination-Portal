// MySQL backend for the Examly Student Examination Portal.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || 3001);
let config;
try { config = require('./config'); }
catch { console.error('Missing config.js. Copy config.example.js to config.js and enter your MySQL password.'); process.exit(1); }
const pool = mysql.createPool(config);
const studentId = 1;
const examId = 1;

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}
async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  try { return body ? JSON.parse(body) : {}; }
  catch { const error = new Error('Request body must be valid JSON.'); error.status = 400; throw error; }
}
async function getAttempt() {
  const [rows] = await pool.execute(`SELECT a.attempt_id AS id, a.status, a.score, a.started_at AS startedAt,
    a.submitted_at AS submittedAt, COUNT(r.response_id) AS answered
    FROM exam_attempts a LEFT JOIN responses r ON r.attempt_id = a.attempt_id
    WHERE a.exam_id = ? AND a.student_id = ? GROUP BY a.attempt_id`, [examId, studentId]);
  if (!rows[0]) return null;
  const attempt = rows[0];
  const [answers] = await pool.execute(`SELECT q.display_order AS questionNumber, o.option_id, o.is_correct,
    (SELECT COUNT(*) FROM options before_o WHERE before_o.question_id = q.question_id AND before_o.option_id < o.option_id) AS optionIndex
    FROM responses r JOIN questions q ON q.question_id = r.question_id
    JOIN options o ON o.option_id = r.selected_option_id WHERE r.attempt_id = ?`, [attempt.id]);
  attempt.answers = Object.fromEntries(answers.map(answer => [answer.questionNumber, Number(answer.optionIndex)]));
  return attempt;
}
async function saveResponse(attemptId, questionNumber, optionIndex) {
  const [attemptRows] = await pool.execute('SELECT status FROM exam_attempts WHERE attempt_id = ? AND student_id = ?', [attemptId, studentId]);
  if (!attemptRows[0]) { const error = new Error('Exam attempt not found.'); error.status = 404; throw error; }
  if (attemptRows[0].status !== 'In Progress') { const error = new Error('Submitted exams cannot be changed.'); error.status = 409; throw error; }
  const [questionRows] = await pool.execute('SELECT question_id FROM questions WHERE exam_id = ? AND display_order = ?', [examId, Number(questionNumber)]);
  if (!questionRows[0]) { const error = new Error('Invalid question.'); error.status = 400; throw error; }
  const [optionRows] = await pool.execute(`SELECT option_id FROM options WHERE question_id = ? ORDER BY option_id LIMIT 1 OFFSET ?`, [questionRows[0].question_id, Number(optionIndex)]);
  if (!optionRows[0]) { const error = new Error('Invalid answer option.'); error.status = 400; throw error; }
  await pool.execute(`INSERT INTO responses (attempt_id, question_id, selected_option_id) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE selected_option_id = VALUES(selected_option_id)`, [attemptId, questionRows[0].question_id, optionRows[0].option_id]);
}
async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/exams/1/attempt') return json(response, 200, { attempt: await getAttempt() });
  if (request.method === 'POST' && url.pathname === '/api/exams/1/attempt') {
    const current = await getAttempt();
    if (current?.status === 'Submitted') return json(response, 409, { message: 'This exam has already been submitted.', attempt: current });
    if (current) return json(response, 200, { attempt: current });
    try { await pool.execute('INSERT INTO exam_attempts (exam_id, student_id) VALUES (?, ?)', [examId, studentId]); }
    catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; }
    return json(response, 201, { attempt: await getAttempt() });
  }
  const responseMatch = url.pathname.match(/^\/api\/attempts\/(\d+)\/responses$/);
  if (request.method === 'PUT' && responseMatch) {
    const { questionNumber, optionIndex } = await readJson(request);
    await saveResponse(Number(responseMatch[1]), questionNumber, optionIndex);
    return json(response, 200, { saved: true });
  }
  const submitMatch = url.pathname.match(/^\/api\/attempts\/(\d+)\/submit$/);
  if (request.method === 'POST' && submitMatch) {
    const attemptId = Number(submitMatch[1]);
    const [rows] = await pool.execute('SELECT status FROM exam_attempts WHERE attempt_id = ? AND student_id = ?', [attemptId, studentId]);
    if (!rows[0]) return json(response, 404, { message: 'Exam attempt not found.' });
    if (rows[0].status === 'Submitted') return json(response, 409, { message: 'This exam is already submitted.', attempt: await getAttempt() });
    const [scoreRows] = await pool.execute(`SELECT COALESCE(SUM(q.marks), 0) AS score FROM responses r
      JOIN options o ON o.option_id = r.selected_option_id AND o.is_correct = TRUE
      JOIN questions q ON q.question_id = r.question_id WHERE r.attempt_id = ?`, [attemptId]);
    await pool.execute("UPDATE exam_attempts SET status = 'Submitted', submitted_at = NOW(), score = ? WHERE attempt_id = ?", [scoreRows[0].score, attemptId]);
    return json(response, 200, { attempt: await getAttempt() });
  }
  return json(response, 404, { message: 'API route not found.' });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.sql': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(request, response, url);
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { response.writeHead(404); return response.end('Not found'); }
    response.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) { console.error(error); json(response, error.status || 500, { message: error.message || 'Server error.' }); }
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Run: npm start -- 3002`);
  else console.error(`Server error: ${error.message}`);
  await pool.end();
  process.exit(1);
});
(async () => {
  try { await pool.query('SELECT 1'); server.listen(PORT, () => console.log(`Examly is running at http://localhost:${PORT}`)); }
  catch (error) { console.error(`MySQL connection failed: ${error.message}`); await pool.end(); process.exit(1); }
})();
