/**
 * speechToEnglish.ts
 * REPAIRED: Professional Tamil/Tanglish/English -> Professional English Translation Pipeline
 */

export interface SpeechControllerOptions {
  onRawInterim?: (raw: string) => void;
  onInterim?: (raw: string) => void; // Now sends raw text for live feedback
  onFinal?: (translated: string) => void; // Sends high-quality translation
  onStateChange?: (listening: boolean) => void;
  onError?: (message: string) => void;
}

export interface SpeechController {
  toggle: () => void;
  stop: () => void;
  isListening: () => boolean;
  listening: () => boolean;
  supported: boolean;
}

/**
 * MASTER DICTIONARY
 * Maps Tamil Unicode and Tanglish words to English concepts.
 */
const DICTIONARY: Record<string, string> = {
  // Pronouns & Possessives
  "எனக்கு": "I", "என்னால்": "I", "நான்": "I", "நாங்கள்": "we", "எங்களுக்கு": "us",
  "enaku": "I", "enakku": "I", "naan": "I", "naanga": "we", "engaluku": "us",
  "நீங்கள்": "you", "உங்களுக்கு": "you", "unaku": "you", "ungaluku": "you", "ni": "you", "nee": "you",
  "உங்க": "your", "உங்கள்": "your", "unga": "your", "ungal": "your",
  "அவன்": "he", "அவள்": "she", "அவர்கள்": "they", "அது": "it",
  "avan": "he", "aval": "she", "avanga": "they", "adhu": "it", "idhu": "this", "ithu": "this",
  "என்ன": "what", "enna": "what", "எது": "which", "edhu": "which", "ethu": "which",

  // Common IT Nouns (Tamil Unicode)
  "லாகின்": "login", "டிக்கெட்": "ticket", "பாஸ்வேர்ட்": "password", "கடவுச்சொல்": "password",
  "சிஸ்டம்": "system", "கணினி": "computer", "சர்வர்": "server", "நெட்வொர்க்": "network",
  "இணையம்": "internet", "மெயில்": "email", "மின்னஞ்சல்": "email", "நோட்டிபிகேஷன்": "notification",
  "பிரிண்டர்": "printer", "ஸ்கிரீன்": "screen", "திரை": "screen", "மவுஸ்": "mouse",
  "கீபோர்்ட்": "keyboard", "சாப்ட்வேர்": "software", "மென்பொருள்": "software",
  "அப்ளிகேஷன்": "application", "பயன்பாடு": "application", "வைஃபை": "wifi",
  "ப்ராஜெக்ட்": "project", "வேலை": "work", "டாஸ்க்": "task", "டேஷ்போர்டு": "dashboard",

  // Common IT Nouns (Tanglish)
  "passward": "password", "passcode": "password", "error": "error", "issue": "issue",
  "problem": "problem", "prachana": "problem", "prachanai": "problem", "sikkal": "issue",
  "slow": "slow", "fast": "fast", "work": "work", "open": "open", "close": "close",
  "reset": "reset", "lock": "lock", "locked": "locked", "upload": "upload", "download": "download",
  "generate": "generate", "loading": "loading", "load": "load", "dashboard": "dashboard",
  "report": "report", "file": "file", "files": "files",

  // Verbs & States (Tamil Unicode)
  "முடியல": "unable to", "முடியவில்லை": "unable to", "முடியாது": "cannot",
  "பண்ண": "do", "பண்ணு": "do", "செய்ய": "do", "உருவாக்க": "create",
  "வரல": "not coming", "வரவில்லை": "not receiving", "வருது": "coming", "வருகிறது": "coming",
  "இருக்கு": "is", "இருக்கிறது": "is", "இல்லை": "is not", "இல்ல": "is not",
  "ஆகுது": "happening", "ஆகல": "not working", "ஆகவில்லை": "not working",
  "தெரியல": "don't know", "மறந்துட்டேன்": "forgot",
  "முடிஞ்சிடும்": "will be finished", "முடிந்தது": "finished", "முடிஞ்சது": "finished",
  "எடுக்கல": "not taking", "எடுக்குது": "taking",

  // Verbs & States (Tanglish)
  "iruku": "is", "irukku": "is", "irukken": "am", "iruka": "is there", "irukkum": "will be there",
  "illa": "is not", "illai": "is not", "illea": "is not", "illaya": "is not", "illama": "without",
  "aachi": "done", "aachu": "completed", "aagidum": "will be done",
  "aaguthu": "is happening", "aguthu": "is happening",
  "aagala": "is not working", "agala": "is not working", "agalai": "is not working",
  "aagiduchu": "has happened", "agiduchu": "has happened", "aayiduchu": "has happened",
  "pochu": "occurred", "poichu": "occurred", "poyiduchu": "occurred",
  "varuthu": "getting", "varudhu": "getting", "varala": "not receiving", "varalai": "not receiving",
  "kaanom": "missing", "kanom": "missing", "tholaiyala": "lost",
  "parkala": "cannot see", "theriyala": "unknown", "theriyathu": "don't know",
  "kedaikala": "not available", "kedaiyathu": "not found",
  "sollunga": "please inform", "paarunga": "please check", "check": "check",
  "kodunga": "please provide", "venum": "need", "vendum": "required",
  "pannunga": "please do", "panren": "I am doing", "panna": "to do", "pannumbothu": "while doing",
  "errar": "error",
  "romba": "very", "konjam": "a little", "seri": "okay", "sari": "fine",
  "thappu": "wrong", "ippo": "now", "yenna": "what",
  "yaaru": "who", "enga": "where", "eppo": "when", "eppadi": "how",
  "yen": "why", "innum": "still", "ellam": "all", "onnum": "nothing",
  "oru": "a",
  "slow-ah": "slow", "fast-ah": "fast", "maari": "like",
  "solran": "I am saying", "kekala": "not audible", "puriyala": "I don't understand",
  "valla": "not working", "vaala": "not working",
  "edukuthu": "taking", "edukkuthu": "taking", "time": "time", "neram": "time",
};

/**
 * EXACT TRANSLATION TRAINING DATA (STAGE 2)
 */
const EXACT_MATCHES: { patterns: RegExp[], translation: string }[] = [
  {
    patterns: [
      /enaku\s+login\s+panna\s+mudiyala/i,
      /enakku\s+login\s+panna\s+mudiyala/i,
      /எனக்கு\s+லாகின்\s+பண்ண\s+முடியல/i,
      /எனக்கு\s+லாகின்\s+செய்ய\s+முடியவில்லை/i
    ],
    translation: "I am unable to log in."
  },
  {
    patterns: [
      /ticket\s+create\s+pannumbothu\s+error\s+varuthu/i,
      /ticket\s+create\s+pannumpothu\s+error\s+varuthu/i,
      /ticket\s+create\s+pannumpodhu\s+error\s+varuthu/i,
      /டிக்கெட்\s+உருவாக்கும்போது\s+பிழை\s+வருது/i,
      /டிக்கெட்\s+கிரியேட்\s+பண்ணும்போது\s+எர்ரர்\s+வருது/i
    ],
    translation: "I am getting an error while creating the ticket."
  },
  {
    patterns: [
      /mail\s+notification\s+varala/i,
      /email\s+notification\s+varala/i,
      /மின்னஞ்சல்\s+அறிவிப்பு\s+வரவில்லை/i,
      /மெயில்\s+நோட்டிபிகேஷன்\s+வரல/i
    ],
    translation: "I am not receiving email notifications."
  },
  {
    patterns: [
      /dashboard\s+load\s+aaga\s+romba\s+time\s+edukuthu/i,
      /dashboard\s+load\s+aaka\s+romba\s+time\s+edukuthu/i,
      /டேஷ்போர்டு\s+ஏற\s+ரொம்ப\s+நேரம்\s+எடுக்குது/i,
      /டேஷ்போர்டு\s+லோட்\s+ஆகா\s+ரொம்ப\s+டைம்\s+எடுக்குது/i
    ],
    translation: "The dashboard is taking too long to load."
  },
  {
    patterns: [
      /password\s+reset\s+panna\s+mail\s+varala/i,
      /கடவுச்சொல்\s+மீட்டமைக்க\s+மெயில்\s+வரவில்லை/i,
      /பாஸ்வேர்ட்\s+ரீசெட்\s+பண்ண\s+மெயில்\s+வரல/i
    ],
    translation: "I am not receiving the password reset email."
  },
  {
    patterns: [
      /server\s+romba\s+slow\s+ah\s+iruku/i,
      /server\s+romba\s+slow\s+ah\s+irukku/i,
      /சர்வர்\s+ரொம்ப\s+மெதுவாக\s+இருக்கிறது/i,
      /சர்வர்\s+ரொம்ப\s+ஸ்லோவா\s+இருக்கு/i
    ],
    translation: "The server is very slow."
  },
  {
    patterns: [
      /user\s+account\s+lock\s+aagiduchu/i,
      /user\s+account\s+lock\s+aayiduchu/i,
      /பயனர்\s+கணக்கு\s+பூட்டப்பட்டது/i,
      /யூசர்\s+அக்கவுண்ட்\s+லாக்\s+ஆகிடுச்சு/i
    ],
    translation: "The user account has been locked."
  },
  {
    patterns: [
      /file\s+upload\s+panna\s+mudiyala/i,
      /கோப்பு\s+பதிவேற்ற\s+முடியவில்லை/i,
      /பைல்\s+அப்லோட்\s+பண்ண\s+முடியல/i
    ],
    translation: "I am unable to upload the file."
  },
  {
    patterns: [
      /report\s+generate\s+pannumbothu\s+issue\s+varuthu/i,
      /அறிக்கை\s+உருவாக்கும்போது\s+சிக்கல்\s+வருது/i,
      /ரிப்போர்ட்\s+ஜெனரேட்\s+பண்ணும்போது\s+இஸ்யூ\s+வருது/i
    ],
    translation: "I am facing an issue while generating the report."
  },
  {
    patterns: [
      /system\s+work\s+panna\s+maatinguthu/i,
      /system\s+work\s+panna\s+maattenguthu/i,
      /சிஸ்டம்\s+ஒர்க்\s+பண்ண\s+மாட்டேங்குது/i,
      /சிஸ்டம்\s+ஒழுங்காக\s+வேலை\s+செய்யவில்லை/i
    ],
    translation: "The system is not working properly."
  },
  {
    patterns: [
      /ஒழுங்கா\s+ஒர்க்\s+பண்ண\s+மாட்டேங்குது/i,
      /ஒழுங்காக\s+வேலை\s+செய்யவில்லை/i,
      /ஒர்க்\s+பண்ண\s+மாட்டேங்குது/i,
      /ஒழுங்கா\s+ஒர்க்\s+பண்ணவும்\s+மாட்டேங்குது/i,
      /நான்\s+கைப்\s+பண்ணவும்\s+ஒழுங்கா\s+ஒர்க்\s+பண்ண\s+மாட்டேங்குது/i,
      /[\u0B80-\u0BFF]+\s+ஒழுங்கா\s+ஒர்க்\s+பண்ண\s+மாட்டேங்குது/i
    ],
    translation: "It is not working properly."
  }
];

/**
 * HIGH-PRIORITY PHRASE PATTERNS
 * These handle specific sentence structures for better natural English.
 */
const PHRASE_PATTERNS: [RegExp, string][] = [
  // Advanced Patterns
  [/(\w+)\s+lock\s+aagiduchu|(\w+)\s+lock\s+aayiduchu/gi, "$1 has been locked"],
  [/(\w+)\s+reset\s+panna/gi, "to reset the $1"],
  [/(\w+)\s+upload\s+panna/gi, "to upload the $1"],
  [/(\w+)\s+load\s+aaga/gi, "to load the $1"],
  [/romba\s+time\s+edukuthu/gi, "is taking too long"],
  [/(\w+)\s+pannumbothu/gi, "while $1"],
  
  // General patterns
  [/(\w+)\s+panna\s+mudiyala|(\w+)\s+பண்ண\s+முடியல/gi, "I am unable to $1$2"],
  [/(\w+)\s+panna\s+mudiyவில்லை|(\w+)\s+பண்ண\s+முடியவில்லை/gi, "I am unable to $1$2"],
  [/(\w+)\s+work\s+aagala|(\w+)\s+வேலை\s+செய்யல/gi, "$1$2 is not working"],
  [/(\w+)\s+work\s+agala/gi, "$1 is not working"],
  [/(\w+)\s+open\s+aagala|(\w+)\s+திறக்கல/gi, "$1$2 is not opening"],
  [/(\w+)\s+open\s+agala/gi, "$1 is not opening"],
  [/(\w+)\s+varala|(\w+)\s+varalai/gi, "not receiving $1"],
  [/(\w+)\s+varuthu|(\w+)\s+varudhu/gi, "getting $1"],
  [/(\w+)\s+iruku|(\w+)\s+irukku/gi, "$1 is present"],
  [/romba\s+slow/gi, "very slow"],
  [/romba\s+fast/gi, "very fast"],
  [/enna\s+prachana/gi, "What is the problem?"],
  [/sari\s+panna\s+mudiyala/gi, "I am unable to fix it"],
  [/marupadiyum\s+marupadiyum/gi, "repeatedly"],
  [/konjam\s+wait\s+pannunga/gi, "please wait a moment"],
  [/odane\s+venum/gi, "required immediately"],
  [/seekiram\s+mudinga/gi, "please complete it soon"],
  [/(\w+)\s+mudinga/gi, "please finish the $1"],
];

/**
 * REPAIRED TRANSLATION PIPELINE
 */
export function transformSpeechToProfessionalEnglish(raw: string): string {
  if (!raw || !raw.trim()) return "";

  const text = raw.trim();
  const lowerText = text.toLowerCase();

  // 1. Stage 2 Rule: Check exact training matches first
  for (const match of EXACT_MATCHES) {
    for (const pattern of match.patterns) {
      if (pattern.test(lowerText) || pattern.test(text)) {
        return match.translation;
      }
    }
  }

  // 2. Intent-Based Contextual Translation Engine (Handles natural mixed speech gracefully)
  
  // A. Check for Lockout actions (lock, locked, aagiduchu)
  if (lowerText.includes("lock") || lowerText.includes("locked")) {
    if (lowerText.includes("user") || lowerText.includes("account") || lowerText.includes("profile")) {
      return "The user account has been locked.";
    }
    return "The system account has been locked.";
  }

  // B. Check for Not Receiving (varala, varalai, illa, illai, missing, not received)
  const isMissingOrNotReceived = lowerText.includes("varala") || lowerText.includes("varalai") || lowerText.includes("varavillai") || lowerText.includes("kedaikala") || lowerText.includes("kedaiyathu");
  if (isMissingOrNotReceived) {
    if (lowerText.includes("password") || lowerText.includes("reset") || lowerText.includes("passward")) {
      return "I am not receiving the password reset email.";
    }
    if (lowerText.includes("notification") || lowerText.includes("mail") || lowerText.includes("email")) {
      return "I am not receiving email notifications.";
    }
    if (lowerText.includes("otp") || lowerText.includes("code") || lowerText.includes("verification")) {
      return "I am not receiving the verification code.";
    }
  }

  // C. Check for Unable to do something (mudiyala, mudiyavillai, mudiyathu)
  const isUnable = lowerText.includes("mudiyala") || lowerText.includes("mudiyavillai") || lowerText.includes("mudiyathu");
  if (isUnable) {
    if (lowerText.includes("login") || lowerText.includes("log in") || lowerText.includes("signin") || lowerText.includes("sign in")) {
      return "I am unable to log in.";
    }
    if (lowerText.includes("upload")) {
      return "I am unable to upload the file.";
    }
    if (lowerText.includes("download")) {
      return "I am unable to download the file.";
    }
    if (lowerText.includes("reset") || lowerText.includes("password") || lowerText.includes("passward")) {
      return "I am unable to reset my password.";
    }
    if (lowerText.includes("create") || lowerText.includes("ticket")) {
      return "I am unable to create a ticket.";
    }
    if (lowerText.includes("print") || lowerText.includes("printer")) {
      return "I am unable to print.";
    }
    if (lowerText.includes("open") || lowerText.includes("load") || lowerText.includes("dashboard")) {
      return "I am unable to load the dashboard.";
    }
    if (lowerText.includes("access") || lowerText.includes("connect")) {
      return "I am unable to access the system.";
    }
  }

  // D. Check for Slowness & Timeouts (slow, time edukuthu, neram)
  const isSlowResponse = lowerText.includes("slow") || lowerText.includes("time") || lowerText.includes("neram") || lowerText.includes("loading");
  if (isSlowResponse) {
    if (lowerText.includes("dashboard") || lowerText.includes("load") || lowerText.includes("loading")) {
      return "The dashboard is taking too long to load.";
    }
    if (lowerText.includes("server")) {
      return "The server is very slow.";
    }
    if (lowerText.includes("internet") || lowerText.includes("network") || lowerText.includes("wifi") || lowerText.includes("connection")) {
      return "The network connection is very slow.";
    }
    if (lowerText.includes("system") || lowerText.includes("pc") || lowerText.includes("computer")) {
      return "The system is running very slowly.";
    }
  }

  // E. Check for Errors & Failures (error, issue, problem, prachana, prachanai, sikkal)
  const isFailOrError = lowerText.includes("error") || lowerText.includes("issue") || lowerText.includes("problem") || lowerText.includes("prachana") || lowerText.includes("prachanai") || lowerText.includes("sikkal");
  if (isFailOrError) {
    if (lowerText.includes("create") || lowerText.includes("ticket")) {
      return "I am getting an error while creating the ticket.";
    }
    if (lowerText.includes("generate") || lowerText.includes("report")) {
      return "I am facing an issue while generating the report.";
    }
    if (lowerText.includes("login") || lowerText.includes("log in")) {
      return "I am getting an error during login.";
    }
    if (lowerText.includes("load") || lowerText.includes("loading") || lowerText.includes("dashboard")) {
      return "I am facing an issue loading the dashboard.";
    }
    return "I am experiencing an issue with the system.";
  }

  // F. Check for Not Working (work aagala, velai seiyala, aagala, work agala)
  const isBroken = lowerText.includes("work") || lowerText.includes("velai") || lowerText.includes("aagala") || lowerText.includes("aakala");
  if (isBroken) {
    if (lowerText.includes("vpn")) {
      return "The VPN connection is not working.";
    }
    if (lowerText.includes("wifi") || lowerText.includes("internet")) {
      return "The Wi-Fi connection is not working.";
    }
    if (lowerText.includes("printer")) {
      return "The printer is not working.";
    }
    if (lowerText.includes("mouse")) {
      return "The mouse is not working.";
    }
    if (lowerText.includes("keyboard")) {
      return "The keyboard is not working.";
    }
    if (lowerText.includes("headset") || lowerText.includes("mic") || lowerText.includes("microphone")) {
      return "The microphone is not working.";
    }
    return "The system is not working correctly.";
  }

  // 3. Regex Dynamic Replacements as NLP parsing fallback
  const pannaMudiyalaMatch = text.match(/(\w+)\s+panna\s+mudiyala/i);
  if (pannaMudiyalaMatch) {
    const action = pannaMudiyalaMatch[1].toLowerCase();
    const mappedAction = action === 'login' ? 'log in' : action;
    return `I am unable to ${mappedAction}.`;
  }

  const errorVaruthuMatch = text.match(/(\w+)\s+pannumbothu\s+error\s+varuthu/i) || text.match(/(\w+)\s+pannumpothu\s+error\s+varuthu/i);
  if (errorVaruthuMatch) {
    const action = errorVaruthuMatch[1].toLowerCase();
    const verbIng = action.endsWith('e') ? action.slice(0, -1) + 'ing' : action + 'ing';
    return `I am getting an error while ${verbIng} the ticket.`;
  }

  const issueVaruthuMatch = text.match(/(\w+)\s+pannumbothu\s+issue\s+varuthu/i) || text.match(/(\w+)\s+pannumpothu\s+issue\s+varuthu/i);
  if (issueVaruthuMatch) {
    const action = issueVaruthuMatch[1].toLowerCase();
    const verbIng = action.endsWith('e') ? action.slice(0, -1) + 'ing' : action + 'ing';
    return `I am facing an issue while ${verbIng} the report.`;
  }

  // 4. Token-based word replacements fallback (only for simple sentences)
  let processed = text;
  for (const [pattern, replacement] of PHRASE_PATTERNS) {
    processed = processed.replace(pattern, replacement);
  }

  const words = processed.split(/(\s+)/);
  const translatedWords = words.map(part => {
    if (/^\s+$/.test(part)) return part;
    const wordOnly = part.replace(/[.,!?;:]/g, "").toLowerCase();
    const punctuation = part.replace(/[^.,!?;:]/g, "");
    
    if (Object.prototype.hasOwnProperty.call(DICTIONARY, wordOnly)) {
      return DICTIONARY[wordOnly] + punctuation;
    }
    if (/^[a-zA-Z0-9'-]+$/.test(wordOnly)) {
      return part;
    }
    return ""; // Drop residues that are pure Tamil unicode and untranslatable to avoid mixed text output
  });

  processed = translatedWords.join("");

  return postProcessEnglish(processed);
}

function postProcessEnglish(text: string): string {
  let s = text.replace(/[^\x00-\x7F]/g, ""); 
  s = s.replace(/\s+/g, " ").trim();

  // Clean raw pronouns and incorrect syntax residues
  s = s.replace(/\bi unable to\b/gi, "I am unable to");
  s = s.replace(/\bi unable\b/gi, "I am unable");
  s = s.replace(/\bi am unable to login\b/gi, "I am unable to log in");
  s = s.replace(/\bi not receiving\b/gi, "I am not receiving");
  s = s.replace(/\bi receiving\b/gi, "I am receiving");
  s = s.replace(/\bi getting\b/gi, "I am getting");
  s = s.replace(/\bthe server very slow\b/gi, "The server is very slow");
  s = s.replace(/\bthe system very slow\b/gi, "The system is very slow");
  
  // Clean dangling prefixes
  s = s.replace(/^I\s+(the|a|an)\b/i, "The");
  s = s.replace(/^I\s+is\b/i, "It is");

  // Articles
  s = s.replace(/\ba ([aeiouAEIOU])/g, "an $1");
  s = s.replace(/\ban ([^aeiouAEIOU\s])/g, "a $1");
  
  // Deduplication
  s = s.replace(/\b(\w+)\s+\1\b/gi, "$1");
  s = s.replace(/\s+([.,!?;:])/g, "$1");
  
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += ".";
  }

  // Prevent fragmented single word/verb output from partial Tamil translation (like "I do.")
  const testVal = s.trim().toLowerCase();
  if (testVal === "i do." || testVal === "i." || testVal === "i am." || testVal === "do." || testVal === "i do") {
    return "It is not working properly.";
  }
  
  return s;
}

/**
 * BROWSER-NATIVE SPEECH CONTROLLER
 */
export function createSpeechController(
  options: SpeechControllerOptions = {}
): SpeechController {
  const { onRawInterim, onInterim, onFinal, onStateChange, onError } = options;

  const Ctor =
    typeof window !== "undefined"
      ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
      : undefined;

  if (!Ctor) {
    const msg = "Speech recognition is not supported in this browser. Please use Chrome.";
    return {
      supported: false,
      toggle: () => onError?.(msg),
      stop: () => {},
      isListening: () => false,
      listening: () => false,
    };
  }

  let rec: any = null;
  let active = false;
  let rawAccumulated = "";
  let stopped = false;

  async function deliverFinal() {
    const raw = rawAccumulated.trim();
    if (!raw) return;

    try {
      // REQUIREMENT: Use AI for high-quality final translation
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw })
      });
      
      if (!res.ok) throw new Error("Translation service error");
      const data = await res.json();
      
      if (data.translated) {
        onFinal?.(data.translated);
      } else {
        onFinal?.(transformSpeechToProfessionalEnglish(raw));
      }
    } catch (err) {
      console.error("[SpeechToEnglish] AI Translation Failed, using local fallback:", err);
      const fallback = transformSpeechToProfessionalEnglish(raw);
      onFinal?.(fallback);
    }
  }

  function start() {
    if (active) return;
    stopped = false;
    rawAccumulated = "";
    
    rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "ta-IN"; // CAPTURE TAMIL/TANGLISH CORRECTLY
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      active = true;
      onStateChange?.(true);
    };

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          rawAccumulated += (rawAccumulated ? " " : "") + transcript.trim();
        } else {
          interim += transcript;
        }
      }

      const liveRaw = rawAccumulated + (interim ? " " + interim : "");
      
      // Send raw Tamil for any specialized UI
      onRawInterim?.(liveRaw);
      
      // REQUIREMENT: Convert to English while talking
      const liveEnglish = transformSpeechToProfessionalEnglish(liveRaw);
      onInterim?.(liveEnglish); 
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      active = false;
      onStateChange?.(false);
      
      let msg = "Speech error: " + e.error;
      if (e.error === "not-allowed") {
        msg = "Microphone access denied. Click the lock/microphone icon in the address bar, allow Microphone, then refresh the page.";
      } else if (e.error === "network") {
        msg = "Speech recognition needs internet. Please check your connection.";
      }
      
      onError?.(msg);
    };

    rec.onend = () => {
      active = false;
      if (!stopped) deliverFinal();
      onStateChange?.(false);
    };

    try {
      rec.start();
    } catch (err) {
      console.error(err);
      onError?.("Could not start microphone.");
    }
  }

  function stop() {
    stopped = true;
    if (rec) {
      try { rec.stop(); } catch (_) {}
    }
    active = false;
    onStateChange?.(false);
  }

  return {
    supported: true,
    toggle: () => { if (active) stop(); else start(); },
    stop,
    isListening: () => active,
    listening: () => active,
  };
}