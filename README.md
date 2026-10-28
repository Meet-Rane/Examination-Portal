# Examly — Student Examination Portal

A responsive student examination portal with a Node.js + MySQL backend.

## Open the UI

## Complete MySQL Workbench setup

### 1. Start MySQL

Open MySQL Workbench and open your **Local instance MySQL** connection. Enter the password you chose when installing MySQL.

### 2. Create the portal database and demo data

1. In Workbench, select **File → Open SQL Script**.
2. Choose `database.sql` from this project folder.
3. Click the lightning-bolt **Execute** button.
4. In the Schemas panel, click refresh. You should see `examination_portal`.

This script creates all tables, keys, the dashboard view, one student, three courses, one examination, and 10 DBMS multiple-choice questions.

### 3. Configure the backend

Open `config.js` in VS Code and set `password` to your local MySQL password. The file is already excluded from Git. `config.example.js` is a reusable blank template.

### 4. Install the backend dependency

Open a terminal in this project folder and run:

```powershell
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

## Database highlights

The runnable MySQL backend is `server.mysql.js`. It stores attempts and responses in the `exam_attempts` and `responses` tables. A unique `(exam_id, student_id)` constraint prevents a student from starting a second attempt; the backend also rejects answer changes after submission.

`database.sql` is both the MySQL 8+ project schema and the script used by the running backend. It includes departments, courses, students, exams, questions, options, attempts, responses, keys, constraints, a view, and demo data.

To import it in MySQL:

```sql
SOURCE database.sql;
```
