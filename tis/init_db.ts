import { execute, setUseSQLite } from "./src/lib/db";

setUseSQLite(true);

async function initMissingTables() {
  console.log("Initializing missing tables...");
  
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS company_email_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        email_address TEXT UNIQUE NOT NULL,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_user TEXT NOT NULL,
        smtp_pass TEXT NOT NULL,
        imap_host TEXT NOT NULL,
        imap_port INTEGER NOT NULL,
        imap_user TEXT NOT NULL,
        imap_pass TEXT NOT NULL,
        encryption TEXT DEFAULT 'TLS',
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ 'company_email_configs' table initialized");
  } catch(e: any) { console.error("Error creating company_email_configs:", e.message); }

  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS ticket_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        visibility_type TEXT DEFAULT 'public',
        created_by TEXT,
        created_by_name TEXT,
        message TEXT,
        metadata_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ 'ticket_activities' table initialized");
  } catch(e: any) { console.error("Error creating ticket_activities:", e.message); }

  console.log("Database initialization complete.");
  process.exit(0);
}

initMissingTables();
