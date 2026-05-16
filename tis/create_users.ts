import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

const ROLES = [
  "ultra_super_admin",
  "super_admin",
  "admin",
  "sub_admin",
  "agent",
  "user"
];

async function createUsers() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("Creating default accounts...");

  for (const role of ROLES) {
    const email = `${role}@technosprint.net`.replace(/_/g, "");
    const password = "Password123!";
    const uid = `prod_${role}_${Date.now()}`;
    
    let name = role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const profile = {
      uid,
      name,
      email,
      role,
      passwordHash: simpleHash(password),
      createdAt: serverTimestamp(),
      disabled: false
    };

    try {
      await setDoc(doc(db, "users", uid), profile);
      console.log(`Created [${name}] -> Email: ${email} | Password: ${password}`);
    } catch (err: any) {
      console.error(`Failed to create ${role}:`, err.message);
    }
  }

  console.log("Finished creating accounts.");
  process.exit(0);
}

createUsers();
