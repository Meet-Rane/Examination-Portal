# Examly — Student Examination Portal

A responsive student examination portal with a Node.js + MySQL backend.

## Complete MySQL Workbench setup

### 1. Start MySQL

Open MySQL Workbench and open your **Local instance MySQL** connection. Enter the password you chose when installing MySQL.

### 2. Create the portal database and demo data

1. In Workbench, select **File → Open SQL Script**.
2. Choose `database/database.sql` from this project folder.
3. Click the lightning-bolt **Execute** button.
4. In the Schemas panel, click refresh. You should see `examination_portal`.

This script creates all tables, keys, the dashboard view, one student, three courses, one examination, and 10 DBMS multiple-choice questions.

If you imported an earlier version of this project before the question bank was added, first run the following in Workbench (this removes only this demo database), then execute the current script again:

```sql
DROP DATABASE IF EXISTS examination_portal;
```

### 3. Configure the backend

Open `backend/config.js` in VS Code and set `password` to your local MySQL password. The file is already excluded from Git. `backend/config.example.js` is a reusable blank template.

### 4. Install the backend dependency

Open a terminal in this project folder and run:

```powershell
cd backend
npm install
```

### 5. Start the portal

Run:

```powershell
npm start
```

Then open `http://localhost:3001` in a browser. If that port is busy too, run `npm start -- 3002` and open `http://localhost:3002`.

The prototype includes:

- Student dashboard and upcoming-exam schedule
- Results and calendar views
- Responsive navigation
- Interactive timed DBMS examination, question palette, answer selection, and submit flow
- REST API that saves answers and submission status in MySQL
- Server-side protection: an exam attempt can only be submitted once; a submitted attempt cannot be restarted or edited
- A normalized SQL schema in `database.sql`

## Project structure

```text
examination-portal/
├── frontend/            # Dashboard, exam flow, and results UI
├── backend/             # Node.js API, MySQL config, and dependencies
├── database/            # MySQL Workbench import script
├── legacy/              # Previous SQLite demo files; not used by this version
└── README.md
```

## Database highlights

The runnable MySQL backend is `backend/server.js`. It stores attempts and responses in the `exam_attempts` and `responses` tables. A unique `(exam_id, student_id)` constraint prevents a student from starting a second attempt; the backend also rejects answer changes after submission.

`database/database.sql` is both the MySQL 8+ project schema and the script used by the running backend. It includes departments, courses, students, exams, questions, options, attempts, responses, keys, constraints, a view, and demo data.

To import it in MySQL:

```sql
SOURCE database/database.sql;
```
