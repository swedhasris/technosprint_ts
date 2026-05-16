import { execute, query } from "./src/lib/db";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

async function cleanDemoData() {
  console.log("Starting Production DB Cleanup...");

  // 1. Clean MySQL / SQLite Data
  try {
    const tablesToTruncate = [
      'tickets',
      'ticket_activities',
      'notifications',
      'activity_sessions',
      'activity_entries',
      'timesheets',
      'time_cards'
    ];

    for (const table of tablesToTruncate) {
      try {
        await execute(`DELETE FROM ${table}`);
        console.log(`[SQL] Cleared table: ${table}`);
      } catch (err: any) {
        console.log(`[SQL] Table ${table} skip/error:`, err.message);
      }
    }

    // Delete demo users
    try {
      await execute(`DELETE FROM users WHERE email LIKE '%demo%' OR email LIKE '%test%' OR role = 'user'`);
      console.log(`[SQL] Cleared demo/test users`);
    } catch (err: any) {}

  } catch (err: any) {
    console.error("[SQL] Cleanup failed:", err.message);
  }

  // 2. Clean Firestore Data
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const collectionsToClear = [
      "tickets",
      "activities",
      "notifications",
      "companies",
      "messages",
      "users",
      "dashboards",
      "settings_categories",
      "settings_subcategories",
      "settings_services",
      "settings_groups",
      "sla_policies"
    ];

    for (const collName of collectionsToClear) {
      try {
        const querySnapshot = await getDocs(collection(db, collName));
        const deletePromises = querySnapshot.docs.map((d) => {
          // keep non-demo users if possible, but let's clear demo users
          if (collName === "users") {
            const data = d.data();
            if (data.email?.includes("demo") || data.email?.includes("test") || data.isDemo) {
              return deleteDoc(doc(db, collName, d.id));
            }
            return Promise.resolve();
          }
          return deleteDoc(doc(db, collName, d.id));
        });
        await Promise.all(deletePromises);
        console.log(`[Firestore] Cleared collection: ${collName}`);
      } catch (err: any) {
        console.log(`[Firestore] Collection ${collName} skip/error:`, err.message);
      }
    }

    console.log("Firestore cleanup finished.");
  } catch (err: any) {
    console.error("Firestore cleanup failed:", err.message);
  }

  console.log("Production DB Cleanup Complete.");
  process.exit(0);
}

cleanDemoData();
