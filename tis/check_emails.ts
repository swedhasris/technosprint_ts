import { query, setUseSQLite } from "./src/lib/db";
setUseSQLite(true);
async function check() {
  try {
    const res = await query("SELECT * FROM company_email_configs");
    console.log("Email Configs Found:", res.length);
    console.log(JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
check();
