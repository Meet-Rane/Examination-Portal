-- Student Examination Portal database (MySQL 8+)
CREATE DATABASE IF NOT EXISTS examination_portal;
USE examination_portal;

CREATE TABLE departments (
  department_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE students (
  student_id INT PRIMARY KEY AUTO_INCREMENT,
  roll_number VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  semester TINYINT NOT NULL CHECK (semester BETWEEN 1 AND 8),
  department_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE courses (
  course_id INT PRIMARY KEY AUTO_INCREMENT,
  course_code VARCHAR(15) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  credits TINYINT NOT NULL DEFAULT 4,
  department_id INT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE exams (
  exam_id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  exam_type ENUM('Quiz','Midterm','Final','Practical') NOT NULL,
  starts_at DATETIME NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  total_marks DECIMAL(6,2) NOT NULL CHECK (total_marks > 0),
  mode ENUM('Online','Offline') NOT NULL DEFAULT 'Online',
  status ENUM('Draft','Scheduled','Open','Closed','Published') NOT NULL DEFAULT 'Draft',
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE questions (
  question_id INT PRIMARY KEY AUTO_INCREMENT,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  marks DECIMAL(5,2) NOT NULL DEFAULT 1,
  display_order INT NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
  UNIQUE (exam_id, display_order)
);

CREATE TABLE options (
  option_id INT PRIMARY KEY AUTO_INCREMENT,
  question_id INT NOT NULL,
  option_text VARCHAR(500) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

CREATE TABLE exam_attempts (
  attempt_id INT PRIMARY KEY AUTO_INCREMENT,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME NULL,
  status ENUM('In Progress','Submitted','Auto Submitted') NOT NULL DEFAULT 'In Progress',
  score DECIMAL(6,2) NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(exam_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  UNIQUE (exam_id, student_id)
);

CREATE TABLE responses (
  response_id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option_id INT NULL,
  FOREIGN KEY (attempt_id) REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(question_id),
  FOREIGN KEY (selected_option_id) REFERENCES options(option_id),
  UNIQUE (attempt_id, question_id)
);

-- Useful view for the student dashboard
CREATE VIEW student_exam_schedule AS
SELECT s.student_id, e.exam_id, c.course_code, c.title AS course_title,
       e.title AS exam_title, e.starts_at, e.duration_minutes, e.total_marks, e.status
FROM students s
JOIN departments d ON d.department_id = s.department_id
JOIN courses c ON c.department_id = d.department_id
JOIN exams e ON e.course_id = c.course_id;

-- Demo data
INSERT INTO departments (name, code) VALUES ('Computer Applications', 'BCA');
INSERT INTO students (roll_number, full_name, email, password_hash, semester, department_id)
VALUES ('BCA2023-041', 'Aisha Sharma', 'aisha.sharma@example.edu', '$2b$12$demo-hash', 4, 1);
INSERT INTO courses (course_code, title, credits, department_id) VALUES
('CS-304', 'Database Management Systems', 4, 1),
('CS-301', 'Operating Systems', 4, 1),
('CS-307', 'Software Engineering', 3, 1);
INSERT INTO exams (course_id, title, exam_type, starts_at, duration_minutes, total_marks, mode, status)
VALUES (1, 'Midterm Examination', 'Midterm', '2026-10-28 10:30:00', 90, 50, 'Online', 'Open');

-- Complete DBMS midterm question bank (10 questions × 5 marks = 50 marks)
INSERT INTO questions (exam_id, question_text, marks, display_order) VALUES
(1, 'Which SQL command is used to retrieve data from a database?', 5, 1),
(1, 'Which key uniquely identifies every record in a table?', 5, 2),
(1, 'Which normal form removes partial dependencies?', 5, 3),
(1, 'A relation in a database is best described as a:', 5, 4),
(1, 'Which clause filters grouped records in SQL?', 5, 5),
(1, 'What does a foreign key enforce?', 5, 6),
(1, 'Which JOIN returns rows with matching values in both tables?', 5, 7),
(1, 'Which command permanently saves a transaction?', 5, 8),
(1, 'An attribute that can hold multiple values is called:', 5, 9),
(1, 'Which SQL operation combines result sets and removes duplicates?', 5, 10);

INSERT INTO options (question_id, option_text, is_correct)
SELECT q.question_id, seed.option_text, seed.is_correct
FROM questions q
JOIN (
  SELECT 'Which SQL command is used to retrieve data from a database?' question_text, 'GET' option_text, FALSE is_correct UNION ALL
  SELECT 'Which SQL command is used to retrieve data from a database?', 'SELECT', TRUE UNION ALL
  SELECT 'Which SQL command is used to retrieve data from a database?', 'FETCH', FALSE UNION ALL
  SELECT 'Which SQL command is used to retrieve data from a database?', 'EXTRACT', FALSE UNION ALL
  SELECT 'Which key uniquely identifies every record in a table?', 'Foreign key', FALSE UNION ALL
  SELECT 'Which key uniquely identifies every record in a table?', 'Composite key', FALSE UNION ALL
  SELECT 'Which key uniquely identifies every record in a table?', 'Primary key', TRUE UNION ALL
  SELECT 'Which key uniquely identifies every record in a table?', 'Candidate field', FALSE UNION ALL
  SELECT 'Which normal form removes partial dependencies?', 'First normal form', FALSE UNION ALL
  SELECT 'Which normal form removes partial dependencies?', 'Second normal form', TRUE UNION ALL
  SELECT 'Which normal form removes partial dependencies?', 'Third normal form', FALSE UNION ALL
  SELECT 'Which normal form removes partial dependencies?', 'BCNF', FALSE UNION ALL
  SELECT 'A relation in a database is best described as a:', 'Column', FALSE UNION ALL
  SELECT 'A relation in a database is best described as a:', 'Table', TRUE UNION ALL
  SELECT 'A relation in a database is best described as a:', 'Query', FALSE UNION ALL
  SELECT 'A relation in a database is best described as a:', 'Constraint', FALSE UNION ALL
  SELECT 'Which clause filters grouped records in SQL?', 'WHERE', FALSE UNION ALL
  SELECT 'Which clause filters grouped records in SQL?', 'ORDER BY', FALSE UNION ALL
  SELECT 'Which clause filters grouped records in SQL?', 'HAVING', TRUE UNION ALL
  SELECT 'Which clause filters grouped records in SQL?', 'DISTINCT', FALSE UNION ALL
  SELECT 'What does a foreign key enforce?', 'Sorting', FALSE UNION ALL
  SELECT 'What does a foreign key enforce?', 'Referential integrity', TRUE UNION ALL
  SELECT 'What does a foreign key enforce?', 'Data encryption', FALSE UNION ALL
  SELECT 'What does a foreign key enforce?', 'Data duplication', FALSE UNION ALL
  SELECT 'Which JOIN returns rows with matching values in both tables?', 'LEFT JOIN', FALSE UNION ALL
  SELECT 'Which JOIN returns rows with matching values in both tables?', 'RIGHT JOIN', FALSE UNION ALL
  SELECT 'Which JOIN returns rows with matching values in both tables?', 'INNER JOIN', TRUE UNION ALL
  SELECT 'Which JOIN returns rows with matching values in both tables?', 'FULL JOIN', FALSE UNION ALL
  SELECT 'Which command permanently saves a transaction?', 'SAVE', FALSE UNION ALL
  SELECT 'Which command permanently saves a transaction?', 'COMMIT', TRUE UNION ALL
  SELECT 'Which command permanently saves a transaction?', 'LOCK', FALSE UNION ALL
  SELECT 'Which command permanently saves a transaction?', 'GRANT', FALSE UNION ALL
  SELECT 'An attribute that can hold multiple values is called:', 'Derived', FALSE UNION ALL
  SELECT 'An attribute that can hold multiple values is called:', 'Simple', FALSE UNION ALL
  SELECT 'An attribute that can hold multiple values is called:', 'Multivalued', TRUE UNION ALL
  SELECT 'An attribute that can hold multiple values is called:', 'Composite', FALSE UNION ALL
  SELECT 'Which SQL operation combines result sets and removes duplicates?', 'JOIN', FALSE UNION ALL
  SELECT 'Which SQL operation combines result sets and removes duplicates?', 'UNION', TRUE UNION ALL
  SELECT 'Which SQL operation combines result sets and removes duplicates?', 'MERGE', FALSE UNION ALL
  SELECT 'Which SQL operation combines result sets and removes duplicates?', 'GROUP BY', FALSE
) AS seed ON seed.question_text = q.question_text
WHERE q.exam_id = 1;
