import { execute, setUseSQLite } from "./src/lib/db";

setUseSQLite(true);

async function run() {
  console.log("Updating SQLite company email configurations...");
  try {
    // Deactivate the old Gmail config (ID 1)
    await execute("UPDATE company_email_configs SET is_active = 0 WHERE id = 1");
    console.log("✓ Deactivated legacy Gmail configuration (ID 1)");

    // Update ID 2 to Technosprint Support
    await execute(`
      UPDATE company_email_configs 
      SET company_name = 'Technosprint',
          email_address = 'Support@technosprint.net',
          smtp_host = 'mail.technosprint.net',
          smtp_port = 465,
          smtp_user = 'Support@technosprint.net',
          smtp_pass = '',
          imap_host = 'mail.technosprint.net',
          imap_port = 993,
          imap_user = 'Support@technosprint.net',
          imap_pass = '',
          encryption = 'TLS',
          is_active = 1,
          is_default = 1
      WHERE id = 2
    `);
    console.log("✓ Updated ID 2 to Technosprint Support (Support@technosprint.net)");
  } catch (e: any) {
    console.error("Failed to update configurations:", e.message);
  }
  process.exit(0);
}

run();
