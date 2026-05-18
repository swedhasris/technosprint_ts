import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./timesheet.sqlite');

db.all("SELECT * FROM notifications_queue ORDER BY id DESC LIMIT 10", [], (err, rows) => {
  if (err) {
    console.error("Error reading notifications_queue:", err);
    return;
  }
  console.log(`--- LAST 10 NOTIFICATIONS QUEUE ROWS ---`);
  console.log(JSON.stringify(rows, null, 2));
});
