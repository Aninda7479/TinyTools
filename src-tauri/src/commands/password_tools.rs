use rand::rngs::OsRng;
use rand::seq::SliceRandom;
use rand::Rng;
use serde::{Deserialize, Serialize};

const LOWERCASE: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const UPPERCASE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &[u8] = b"0123456789";
const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{}|;:,.<>?/";
const AMBIGUOUS: &[char] = &['O', '0', 'I', 'l', '1'];

const WORD_LIST: &[&str] = &[
    "abacus", "abandon", "ability", "able", "about", "above", "absent", "absorb",
    "abstract", "absurd", "abuse", "access", "accident", "account", "accuse", "achieve",
    "acid", "acoustic", "acquire", "across", "act", "action", "actor", "actress",
    "actual", "adapt", "add", "addict", "address", "adjust", "admit", "adult",
    "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age",
    "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm",
    "album", "alcohol", "alert", "alien", "all", "alley", "allow", "almost",
    "alone", "alpha", "already", "also", "alter", "always", "amateur", "amazing",
    "among", "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle",
    "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna",
    "antique", "anxiety", "any", "apart", "apology", "appear", "apple", "approve",
    "april", "arch", "arctic", "area", "arena", "argue", "arm", "armed",
    "armor", "army", "around", "arrange", "arrest", "arrive", "arrow", "art",
    "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset", "assist",
    "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract",
    "auction", "audit", "august", "aunt", "author", "auto", "autumn", "average",
    "avocado", "avoid", "awake", "aware", "awesome", "awful", "awkward", "axis",
    "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball",
    "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base",
    "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
    "beef", "before", "begin", "behave", "behind", "believe", "below", "belt",
    "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle",
    "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black",
    "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood",
    "blossom", "blow", "blue", "blur", "blush", "board", "boat", "body",
    "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring",
    "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain",
    "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief",
    "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother",
    "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
    "bulk", "bullet", "bundle", "bunny", "burden", "burger", "burst", "bus",
    "business", "busy", "butter", "buyer", "buzz", "cabbage", "cabin", "cable",
    "cactus", "cage", "cake", "call", "calm", "camera", "camp", "can",
    "canal", "cancel", "candy", "cannon", "canoe", "canvas", "canyon", "capable",
    "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry",
    "cart", "case", "cash", "casino", "castle", "casual", "cat", "catalog",
    "catch", "category", "cattle", "caught", "cause", "caution", "cave", "ceiling",
    "celery", "cement", "census", "century", "cereal", "certain", "chair", "chalk",
    "champion", "change", "chaos", "chapter", "charge", "chase", "cheap", "check",
    "cheese", "chef", "cherry", "chest", "chicken", "chief", "child", "chimney",
    "choice", "choose", "chronic", "chuckle", "chunk", "churn", "citizen", "city",
    "civil", "claim", "clap", "clarify", "claw", "clay", "clean", "clerk",
    "clever", "click", "client", "cliff", "climb", "clinic", "clip", "clock",
    "clog", "close", "cloth", "cloud", "clown", "club", "clump", "cluster",
    "clutch", "coach", "coast", "coconut", "code", "coffee", "coil", "coin",
    "collect", "color", "column", "combine", "come", "comfort", "comic", "common",
    "company", "concert", "conduct", "confirm", "congress", "connect", "consider", "control",
    "convince", "cook", "cool", "copper", "copy", "coral", "core", "corn",
    "correct", "cost", "cotton", "couch", "country", "couple", "course", "cousin",
    "cover", "coyote", "crack", "cradle", "craft", "cram", "crane", "crash",
    "crater", "crawl", "crazy", "cream", "credit", "creek", "crew", "cricket",
    "crime", "crisp", "critic", "crop", "cross", "crouch", "crowd", "crucial",
    "cruel", "cruise", "crumble", "crush", "cry", "crystal", "cube", "culture",
    "cup", "cupboard", "curious", "current", "curtain", "curve", "cushion", "custom",
    "cute", "cycle", "dad", "damage", "damp", "dance", "danger", "daring",
    "dash", "daughter", "dawn", "day", "deal", "debate", "debris", "decade",
    "december", "decide", "decline", "decorate", "decrease", "deer", "defense", "define",
    "defy", "degree", "delay", "deliver", "demand", "demise", "denial", "dentist",
    "deny", "depart", "depend", "deposit", "depth", "deputy", "derive", "describe",
    "desert", "design", "desk", "despair", "destroy", "detail", "detect", "develop",
    "device", "devote", "diagram", "dial", "diamond", "diary", "dice", "diesel",
    "diet", "differ", "digital", "dignity", "dilemma", "dinner", "dinosaur", "direct",
    "dirt", "disagree", "discover", "disease", "dish", "dismiss", "disorder", "display",
    "distance", "divert", "divide", "divorce", "dizzy", "doctor", "document", "dog",
    "doll", "dolphin", "domain", "donate", "donkey", "donor", "door", "dose",
    "double", "dove", "draft", "dragon", "drama", "drastic", "draw", "dream",
    "dress", "drift", "drill", "drink", "drip", "drive", "drop", "drum",
    "dry", "duck", "dumb", "dune", "during", "dust", "dutch", "duty",
    "dwarf", "dynamic", "eager", "eagle", "early", "earn", "earth", "easily",
    "east", "easy", "echo", "ecology", "economy", "edge", "edit", "educate",
    "effort", "egg", "eight", "either", "elbow", "elder", "electric", "elegant",
    "element", "elephant", "elevator", "elite", "else", "embark", "embody", "embrace",
    "emerge", "emotion", "employ", "empower", "empty", "enable", "encourage", "end",
    "endless", "endorse", "enemy", "energy", "enforce", "engage", "engine", "enhance",
    "enjoy", "enlist", "enough", "enrich", "enroll", "ensure", "enter", "entire",
    "entry", "envelope", "episode", "equal", "equip", "era", "erase", "erode",
    "erosion", "error", "erupt", "escape", "essay", "essence", "estate", "eternal",
    "ethics", "evidence", "evil", "evoke", "evolve", "exact", "example", "excess",
    "exchange", "excite", "exclude", "excuse", "execute", "exercise", "exhaust", "exhibit",
    "exile", "exist", "exit", "exotic", "expand", "expect", "expire", "explain",
    "expose", "express", "extend", "extra", "eye", "eyebrow", "fabric", "face",
    "faculty", "fade", "faint", "faith", "fall", "false", "fame", "family",
    "famous", "fan", "fancy", "fantasy", "farm", "fashion", "fat", "fatal",
    "father", "fatigue", "fault", "favorite", "feature", "february", "federal", "fee",
    "feed", "feel", "female", "fence", "festival", "fetch", "fever", "few",
    "fiber", "fiction", "field", "figure", "file", "film", "filter", "final",
    "find", "fine", "finger", "finish", "fire", "firm", "fiscal", "fish",
    "fit", "fitness", "fix", "flag", "flame", "flash", "flat", "flavor",
    "flee", "flight", "flip", "float", "flock", "floor", "flower", "fluid",
    "flush", "fly", "foam", "focus", "fog", "foil", "fold", "follow",
    "food", "foot", "force", "forest", "forget", "fork", "fortune", "forum",
    "forward", "fossil", "foster", "found", "fox", "fragile", "frame", "frequent",
    "fresh", "friend", "fringe", "frog", "front", "frost", "frown", "frozen",
    "fruit", "fuel", "fun", "funny", "furnace", "fury", "future", "gadget",
    "gain", "galaxy", "gallery", "game", "gap", "garage", "garbage", "garden",
    "garlic", "garment", "gas", "gasp", "gate", "gather", "gauge", "gaze",
    "general", "genius", "genre", "gentle", "genuine", "gesture", "ghost", "giant",
    "gift", "giggle", "ginger", "giraffe", "girl", "give", "glad", "glance",
    "glare", "glass", "glide", "glimpse", "globe", "gloom", "glory", "glove",
    "glow", "glue", "goat", "goddess", "gold", "good", "goose", "gorilla",
    "gospel", "gossip", "govern", "gown", "grab", "grace", "grain", "grant",
    "grape", "grass", "gravity", "great", "green", "grid", "grief", "grit",
    "grocery", "group", "grow", "grunt", "guard", "guess", "guide", "guilt",
    "guitar", "gun", "gym", "habit", "hair", "half", "hammer", "hamster",
    "hand", "happy", "harbor", "hard", "harsh", "harvest", "hat", "have",
    "hawk", "hazard", "head", "health", "heart", "heavy", "hedgehog", "height",
    "hello", "helmet", "help", "hen", "hero", "hip", "hire", "history",
    "hobby", "hockey", "hold", "hole", "holiday", "hollow", "home", "honey",
    "hood", "hope", "horn", "horror", "horse", "hospital", "host", "hotel",
    "hour", "hover", "hub", "huge", "human", "humble", "humor", "hundred",
    "hungry", "hunt", "hurdle", "hurry", "hurt", "husband", "hybrid", "ice",
    "icon", "idea", "identify", "idle", "ignore", "ill", "illegal", "illness",
    "image", "imitate", "immense", "immune", "impact", "impose", "improve", "impulse",
    "inch", "include", "income", "increase", "index", "indicate", "indoor", "industry",
    "infant", "inflict", "inform", "initial", "inject", "inmate", "inner", "innocent",
    "input", "inquiry", "insane", "insect", "inside", "inspire", "install", "intact",
    "interest", "into", "invest", "invite", "involve", "iron", "island", "isolate",
    "issue", "item", "ivory", "jacket", "jaguar", "jar", "jazz", "jealous",
    "jeans", "jelly", "jewel", "job", "join", "joke", "journey", "joy",
    "judge", "juice", "jump", "jungle", "junior", "junk", "just", "kangaroo",
    "keen", "keep", "ketchup", "key", "kick", "kid", "kidney", "kind",
    "kingdom", "kiss", "kit", "kitchen", "kite", "kitten", "kiwi", "knee",
    "knife", "knock", "know", "lab", "label", "labor", "ladder", "lady",
    "lake", "lamp", "language", "laptop", "large", "later", "latin", "laugh",
    "laundry", "lava", "law", "lawn", "lawsuit", "layer", "lazy", "leader",
    "leaf", "learn", "leave", "lecture", "left", "leg", "legal", "legend",
    "leisure", "lemon", "lend", "length", "lens", "leopard", "lesson", "letter",
    "level", "liberty", "library", "license", "life", "lift", "light", "like",
    "limb", "limit", "link", "lion", "liquid", "list", "little", "live",
    "lizard", "load", "loan", "lobster", "local", "lock", "logic", "lonely",
    "long", "loop", "lottery", "loud", "lounge", "love", "loyal", "lucky",
    "luggage", "lumber", "lunar", "lunch", "luxury", "lyrics", "machine", "mad",
    "magic", "magnet", "maid", "mail", "main", "major", "make", "mammal",
    "man", "manage", "mandate", "mango", "mansion", "manual", "maple", "marble",
    "march", "margin", "marine", "market", "marriage", "mask", "mass", "master",
    "match", "material", "math", "matrix", "matter", "maximum", "maze", "meadow",
    "mean", "measure", "meat", "mechanic", "medal", "media", "melody", "melt",
    "member", "memory", "mention", "menu", "mercy", "merge", "merit", "merry",
    "mesh", "message", "metal", "method", "middle", "midnight", "milk", "million",
    "mimic", "mind", "minimum", "minor", "minute", "miracle", "mirror", "misery",
    "miss", "mistake", "mix", "mixed", "mixture", "mobile", "model", "modify",
    "mom", "moment", "monitor", "monkey", "monster", "month", "moon", "moral",
    "more", "morning", "mosquito", "mother", "motion", "motor", "mountain", "mouse",
    "move", "movie", "much", "muffin", "mule", "multiply", "muscle", "museum",
    "mushroom", "music", "must", "mutual", "myself", "mystery", "myth", "naive",
    "name", "napkin", "narrow", "nasty", "nation", "nature", "near", "neck",
    "need", "negative", "neglect", "neither", "nephew", "nerve", "nest", "net",
    "network", "neutral", "never", "news", "next", "nice", "night", "noble",
    "noise", "nominee", "noodle", "normal", "north", "nose", "notable", "nothing",
    "notice", "novel", "now", "nuclear", "number", "nurse", "nut", "oak",
    "obey", "object", "oblige", "obscure", "observe", "obtain", "obvious", "occur",
    "ocean", "october", "odor", "off", "offer", "office", "often", "oil",
    "okay", "old", "olive", "olympic", "omit", "once", "one", "onion",
    "online", "only", "open", "opera", "opinion", "oppose", "option", "orange",
    "orbit", "orchard", "order", "ordinary", "organ", "orient", "original", "orphan",
    "ostrich", "other", "outdoor", "outer", "output", "outside", "oval", "oven",
    "over", "own", "owner", "oxygen", "oyster", "ozone", "pact", "paddle",
    "page", "pair", "palace", "palm", "panda", "panel", "panic", "panther",
    "paper", "parade", "parent", "park", "parrot", "party", "pass", "patch",
    "path", "patient", "patrol", "pattern", "pause", "pave", "payment", "peace",
    "peanut", "pear", "peasant", "pelican", "pen", "penalty", "pencil", "people",
    "pepper", "perfect", "permit", "person", "pet", "phone", "photo", "phrase",
    "physical", "piano", "picnic", "picture", "piece", "pig", "pigeon", "pill",
    "pilot", "pink", "pioneer", "pipe", "pistol", "pitch", "pizza", "place",
    "planet", "plastic", "plate", "play", "please", "pledge", "pluck", "plug",
    "plunge", "poem", "poet", "point", "polar", "pole", "police", "pond",
    "pony", "pool", "popular", "portion", "position", "possible", "post", "potato",
    "pottery", "poverty", "powder", "power", "practice", "praise", "predict", "prefer",
    "prepare", "present", "pretty", "prevent", "price", "pride", "primary", "print",
    "priority", "prison", "private", "prize", "problem", "process", "produce", "profit",
    "program", "project", "promote", "proof", "property", "prosper", "protect", "proud",
    "provide", "public", "pudding", "pull", "pulp", "pulse", "pumpkin", "punch",
    "pupil", "puppy", "purchase", "purity", "purpose", "purse", "push", "put",
    "puzzle", "pyramid", "quality", "quantum", "quarter", "question", "quick", "quit",
    "quiz", "quote", "rabbit", "raccoon", "race", "rack", "radar", "radio",
    "rage", "rail", "rain", "raise", "rally", "ramp", "ranch", "random",
    "range", "rapid", "rare", "rate", "rather", "raven", "raw", "razor",
    "ready", "real", "reason", "rebel", "rebuild", "recall", "receive", "recipe",
    "record", "recycle", "reduce", "reflect", "reform", "region", "regret", "regular",
    "reject", "relax", "release", "relief", "rely", "remain", "remember", "remind",
    "remove", "render", "renew", "rent", "reopen", "repair", "repeat", "replace",
    "report", "require", "rescue", "resemble", "resist", "resource", "response", "result",
    "retire", "retreat", "return", "reunion", "reveal", "review", "reward", "rhythm",
    "rib", "ribbon", "rice", "rich", "ride", "ridge", "rifle", "right",
    "rigid", "ring", "riot", "ripple", "risk", "ritual", "rival", "river",
    "road", "roast", "robot", "robust", "rocket", "romance", "roof", "rookie",
    "room", "rose", "rotate", "rough", "round", "route", "royal", "rubber",
    "rude", "rug", "rule", "run", "runway", "rural", "sad", "saddle",
    "sadness", "safe", "sail", "salad", "salmon", "salute", "same", "sample",
    "sand", "satisfy", "satoshi", "sauce", "sausage", "save", "say", "scale",
    "scan", "scare", "scatter", "scene", "scheme", "school", "science", "scissors",
    "scorpion", "scout", "scrap", "screen", "script", "scrub", "sea", "search",
    "season", "seat", "second", "secret", "section", "security", "seed", "seek",
    "segment", "select", "sell", "seminar", "senior", "sense", "sentence", "series",
    "service", "session", "settle", "setup", "seven", "shadow", "shaft", "shallow",
    "share", "shed", "shell", "sheriff", "shield", "shift", "shine", "ship",
    "shiver", "shock", "shoe", "shoot", "shop", "short", "shoulder", "shove",
    "shrimp", "shrug", "shuffle", "shy", "sibling", "sick", "side", "siege",
    "sight", "sign", "silent", "silk", "silly", "silver", "similar", "simple",
    "since", "sing", "siren", "sister", "situate", "six", "size", "skate",
    "sketch", "ski", "skill", "skin", "skirt", "skull", "slab", "slam",
    "sleep", "slender", "slice", "slide", "slight", "slim", "slogan", "slot",
    "slow", "slush", "small", "smart", "smile", "smoke", "smooth", "snack",
    "snake", "snap", "sniff", "snow", "soap", "soccer", "social", "sock",
    "soda", "soft", "solar", "soldier", "solid", "solution", "solve", "someone",
    "song", "soon", "sorry", "sort", "soul", "sound", "soup", "source",
    "south", "space", "spare", "spatial", "spawn", "speak", "special", "speed",
    "spell", "spend", "sphere", "spice", "spider", "spike", "spin", "spirit",
    "split", "sponsor", "spoon", "sport", "spot", "spray", "spread", "spring",
    "spy", "square", "squeeze", "squirrel", "stable", "stadium", "staff", "stage",
    "stairs", "stamp", "stand", "start", "state", "stay", "steak", "steel",
    "stem", "step", "stereo", "stick", "still", "sting", "stock", "stomach",
    "stone", "stool", "story", "stove", "strategy", "street", "strike", "strong",
    "struggle", "student", "stuff", "stumble", "style", "subject", "submit", "subway",
    "success", "such", "sudden", "suffer", "sugar", "suggest", "suit", "summer",
    "sun", "sunny", "sunset", "super", "supply", "supreme", "sure", "surface",
    "surge", "surprise", "surround", "survey", "suspect", "sustain", "swallow", "swamp",
    "swap", "swarm", "swear", "sweet", "swim", "swing", "switch", "sword",
    "symbol", "symptom", "syrup", "system", "table", "tackle", "tag", "tail",
    "talent", "talk", "tank", "tape", "target", "task", "taste", "tattoo",
    "taxi", "teach", "team", "tell", "ten", "tenant", "tennis", "tent",
    "term", "test", "text", "thank", "that", "theme", "then", "theory",
    "there", "they", "thing", "this", "thought", "three", "thrive", "throw",
    "thumb", "thunder", "ticket", "tide", "tiger", "tilt", "timber", "time",
    "tiny", "tip", "tired", "tissue", "title", "toast", "tobacco", "today",
    "toddler", "toe", "together", "toilet", "token", "tomato", "tomorrow", "tone",
    "tongue", "tonight", "tool", "tooth", "top", "topic", "topple", "torch",
    "tornado", "tortoise", "toss", "total", "tourist", "toward", "tower", "town",
    "toy", "track", "trade", "traffic", "tragic", "train", "transfer", "trap",
    "trash", "travel", "tray", "treat", "tree", "trend", "trial", "tribe",
    "trick", "trigger", "trim", "trip", "trophy", "trouble", "truck", "true",
    "truly", "trumpet", "trust", "truth", "try", "tube", "tuna", "tunnel",
    "turkey", "turn", "turtle", "twelve", "twenty", "twice", "twin", "twist",
    "two", "type", "typical", "ugly", "umbrella", "unable", "unaware", "uncle",
    "uncover", "under", "undo", "unfair", "unfold", "unhappy", "uniform", "union",
    "unique", "unit", "universe", "unknown", "unlock", "until", "unusual", "unveil",
    "update", "upgrade", "uphold", "upon", "upper", "upset", "urban", "usage",
    "use", "used", "useful", "useless", "usual", "utility", "vacant", "vacuum",
    "vague", "valid", "valley", "valve", "van", "vanish", "vapor", "various",
    "vast", "vault", "vehicle", "velvet", "vendor", "venture", "venue", "verb",
    "verify", "version", "very", "vessel", "veteran", "viable", "vibrant", "vicious",
    "victory", "video", "view", "village", "vintage", "violin", "virtual", "virus",
    "visa", "visit", "visual", "vital", "vivid", "vocal", "voice", "void",
    "volcano", "volume", "vote", "voyage", "wage", "wagon", "wait", "walk",
    "wall", "walnut", "want", "warfare", "warm", "warrior", "wash", "wasp",
    "waste", "water", "wave", "way", "wealth", "weapon", "wear", "weasel",
    "weather", "web", "wedding", "weekend", "weird", "welcome", "well", "west",
    "wet", "whale", "what", "wheat", "wheel", "when", "where", "whip",
    "whisper", "wide", "width", "wife", "wild", "will", "win", "window",
    "wine", "wing", "wink", "winner", "winter", "wire", "wisdom", "wise",
    "wish", "witness", "wolf", "woman", "wonder", "wood", "wool", "word",
    "work", "world", "worry", "worth", "wrap", "wreck", "wrestle", "wrist",
    "write", "wrong", "yard", "year", "yellow", "you", "young", "youth",
    "zebra", "zero", "zone", "zoo",
];

#[derive(Serialize, Deserialize)]
pub struct GeneratedPassword {
    pub password: String,
    pub entropy_bits: f64,
    pub strength_label: String,
    pub charset_size: usize,
    pub length: usize,
}

#[derive(Serialize, Deserialize)]
pub struct BulkResult {
    pub passwords: Vec<GeneratedPassword>,
    pub count: usize,
    pub exported_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct PasswordRequest {
    pub mode: String,
    pub length: Option<usize>,
    pub word_count: Option<usize>,
    pub count: Option<usize>,
    pub uppercase: Option<bool>,
    pub lowercase: Option<bool>,
    pub digits: Option<bool>,
    pub symbols: Option<bool>,
    pub exclude_ambiguous: Option<bool>,
    pub custom_symbols: Option<String>,
    pub separator: Option<String>,
    pub pattern: Option<String>,
}

fn compute_entropy(length: usize, pool_size: usize) -> f64 {
    if pool_size <= 1 || length == 0 {
        return 0.0;
    }
    (length as f64) * (pool_size as f64).log2()
}

fn strength_label(entropy: f64) -> String {
    if entropy < 28.0 {
        "Very Weak".to_string()
    } else if entropy < 36.0 {
        "Weak".to_string()
    } else if entropy < 60.0 {
        "Fair".to_string()
    } else if entropy < 80.0 {
        "Strong".to_string()
    } else if entropy < 128.0 {
        "Very Strong".to_string()
    } else {
        "Overkill".to_string()
    }
}

fn build_pool(req: &PasswordRequest) -> Vec<u8> {
    let mut pool: Vec<u8> = Vec::new();
    if req.lowercase.unwrap_or(true) { pool.extend_from_slice(LOWERCASE); }
    if req.uppercase.unwrap_or(true) { pool.extend_from_slice(UPPERCASE); }
    if req.digits.unwrap_or(true) { pool.extend_from_slice(DIGITS); }
    if req.symbols.unwrap_or(true) { pool.extend_from_slice(SYMBOLS); }
    if let Some(custom) = &req.custom_symbols {
        pool.extend_from_slice(custom.as_bytes());
    }
    if req.exclude_ambiguous.unwrap_or(false) {
        pool.retain(|&b| !AMBIGUOUS.contains(&(b as char)));
    }
    pool.dedup();
    pool
}

#[tauri::command]
pub fn generate_password(req: PasswordRequest) -> Result<GeneratedPassword, String> {
    match req.mode.as_str() {
        "random" => generate_random_password(&req),
        "passphrase" => generate_passphrase(&req),
        "pin" => generate_pin(&req),
        "pronounceable" => generate_pronounceable(&req),
        "pattern" => generate_pattern(&req),
        _ => Err(format!("Unknown mode: {}", req.mode)),
    }
}

fn generate_random_password(req: &PasswordRequest) -> Result<GeneratedPassword, String> {
    let pool = build_pool(req);
    if pool.is_empty() { return Err("No characters selected".to_string()); }
    let length = req.length.unwrap_or(16).max(1).min(128);
    let mut rng = OsRng;
    let password: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..pool.len());
            pool[idx] as char
        })
        .collect();
    let entropy = compute_entropy(length, pool.len());
    Ok(GeneratedPassword {
        password,
        entropy_bits: entropy,
        strength_label: strength_label(entropy),
        charset_size: pool.len(),
        length,
    })
}

fn generate_passphrase(req: &PasswordRequest) -> Result<GeneratedPassword, String> {
    let count = req.word_count.unwrap_or(4).max(2).min(12);
    let sep = req.separator.clone().unwrap_or_else(|| "-".to_string());
    let mut rng = OsRng;
    let words: Vec<&str> = (0..count).map(|_| *WORD_LIST.choose(&mut rng).unwrap()).collect();
    let password = words.join(&sep);
    let entropy = compute_entropy(count, WORD_LIST.len());
    Ok(GeneratedPassword {
        password: password.clone(),
        entropy_bits: entropy,
        strength_label: strength_label(entropy),
        charset_size: WORD_LIST.len(),
        length: password.len(),
    })
}

fn generate_pin(req: &PasswordRequest) -> Result<GeneratedPassword, String> {
    let length = req.length.unwrap_or(6).max(4).min(12);
    let mut rng = OsRng;
    let password: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..DIGITS.len());
            DIGITS[idx] as char
        })
        .collect();
    let entropy = compute_entropy(length, 10);
    Ok(GeneratedPassword {
        password,
        entropy_bits: entropy,
        strength_label: strength_label(entropy),
        charset_size: 10,
        length,
    })
}

fn generate_pronounceable(req: &PasswordRequest) -> Result<GeneratedPassword, String> {
    let mut rng = OsRng;
    let syllables = req.length.unwrap_or(3).max(1).min(20);
    let mut password = String::new();
    for i in 0..syllables {
        if i > 0 { password.push('-'); }
        let c = LOWERCASE[rng.gen_range(0..LOWERCASE.len())] as char;
        let v = b"aeiou"[rng.gen_range(0..5)] as char;
        let c2 = LOWERCASE[rng.gen_range(0..LOWERCASE.len())] as char;
        password.push(c);
        password.push(v);
        password.push(c2);
    }
    if req.digits.unwrap_or(true) {
        let d1 = DIGITS[rng.gen_range(0..DIGITS.len())] as char;
        let d2 = DIGITS[rng.gen_range(0..DIGITS.len())] as char;
        password.push_str(&format!("-{}{}", d1, d2));
    }
    let entropy = compute_entropy(syllables, 26 * 5 * 26);
    let len = password.len();
    Ok(GeneratedPassword {
        password,
        entropy_bits: entropy,
        strength_label: strength_label(entropy),
        charset_size: 26 * 5 * 26,
        length: len,
    })
}

fn generate_pattern(req: &PasswordRequest) -> Result<GeneratedPassword, String> {
    let pattern = req.pattern.clone().unwrap_or_else(|| "aaa-999-AAA".to_string());
    let mut rng = OsRng;
    let mut password = String::new();
    let mut pool_info: Vec<(usize, usize)> = Vec::new();

    for ch in pattern.chars() {
        match ch {
            'a' => {
                let c = LOWERCASE[rng.gen_range(0..LOWERCASE.len())] as char;
                password.push(c);
                pool_info.push((password.len() - 1, 26));
            }
            'A' => {
                let c = UPPERCASE[rng.gen_range(0..UPPERCASE.len())] as char;
                password.push(c);
                pool_info.push((password.len() - 1, 26));
            }
            '9' => {
                let c = DIGITS[rng.gen_range(0..DIGITS.len())] as char;
                password.push(c);
                pool_info.push((password.len() - 1, 10));
            }
            '!' => {
                let c = SYMBOLS[rng.gen_range(0..SYMBOLS.len())] as char;
                password.push(c);
                pool_info.push((password.len() - 1, SYMBOLS.len()));
            }
            _ => password.push(ch),
        }
    }
    let total_entropy: f64 = pool_info.iter().map(|(_, n)| (*n as f64).log2()).sum();
    Ok(GeneratedPassword {
        password: password.clone(),
        entropy_bits: total_entropy,
        strength_label: strength_label(total_entropy),
        charset_size: pool_info.len(),
        length: password.len(),
    })
}

#[tauri::command]
pub fn generate_bulk(req: PasswordRequest) -> Result<BulkResult, String> {
    let count = req.count.unwrap_or(10).max(1).min(1000);
    let mut passwords = Vec::with_capacity(count);
    for _ in 0..count {
        passwords.push(generate_password(PasswordRequest {
            mode: req.mode.clone(),
            length: req.length,
            word_count: req.word_count,
            count: None,
            uppercase: req.uppercase,
            lowercase: req.lowercase,
            digits: req.digits,
            symbols: req.symbols,
            exclude_ambiguous: req.exclude_ambiguous,
            custom_symbols: req.custom_symbols.clone(),
            separator: req.separator.clone(),
            pattern: req.pattern.clone(),
        })?);
    }
    let count = passwords.len();
    Ok(BulkResult { passwords, count, exported_path: None })
}

#[tauri::command]
pub fn export_passwords(passwords: Vec<String>, format: String, output_path: String) -> Result<String, String> {
    let content = match format.as_str() {
        "csv" => {
            let mut lines = vec!["password".to_string()];
            for p in &passwords {
                lines.push(format!("\"{}\"", p.replace('"', "\"\"")));
            }
            lines.join("\n")
        }
        "txt" | _ => passwords.join("\n"),
    };
    std::fs::write(&output_path, content).map_err(|e| e.to_string())?;
    Ok(output_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_random_password() {
        let req = PasswordRequest {
            mode: "random".to_string(),
            length: Some(20),
            word_count: None,
            count: None,
            uppercase: Some(true),
            lowercase: Some(true),
            digits: Some(true),
            symbols: Some(true),
            exclude_ambiguous: None,
            custom_symbols: None,
            separator: None,
            pattern: None,
        };
        let result = generate_password(req).unwrap();
        assert_eq!(result.password.len(), 20);
        assert!(result.entropy_bits > 0.0);
        assert_eq!(result.charset_size, 26 + 26 + 10 + 27);
    }

    #[test]
    fn test_generate_pin() {
        let req = PasswordRequest {
            mode: "pin".to_string(),
            length: Some(8),
            word_count: None,
            count: None,
            uppercase: None,
            lowercase: None,
            digits: None,
            symbols: None,
            exclude_ambiguous: None,
            custom_symbols: None,
            separator: None,
            pattern: None,
        };
        let result = generate_password(req).unwrap();
        assert_eq!(result.password.len(), 8);
        assert!(result.password.chars().all(|c| c.is_ascii_digit()));
        assert_eq!(result.charset_size, 10);
    }

    #[test]
    fn test_generate_passphrase() {
        let req = PasswordRequest {
            mode: "passphrase".to_string(),
            length: None,
            word_count: Some(4),
            count: None,
            uppercase: None,
            lowercase: None,
            digits: None,
            symbols: None,
            exclude_ambiguous: None,
            custom_symbols: None,
            separator: Some("-".to_string()),
            pattern: None,
        };
        let result = generate_password(req).unwrap();
        let parts: Vec<&str> = result.password.split('-').collect();
        assert_eq!(parts.len(), 4);
        for part in &parts {
            assert!(WORD_LIST.contains(part));
        }
    }

    #[test]
    fn test_generate_pronounceable() {
        let req = PasswordRequest {
            mode: "pronounceable".to_string(),
            length: Some(3),
            word_count: None,
            count: None,
            uppercase: None,
            lowercase: None,
            digits: Some(true),
            symbols: None,
            exclude_ambiguous: None,
            custom_symbols: None,
            separator: None,
            pattern: None,
        };
        let result = generate_password(req).unwrap();
        assert!(result.password.len() > 10);
        assert!(result.password.contains('-'));
    }

    #[test]
    fn test_generate_pattern() {
        let req = PasswordRequest {
            mode: "pattern".to_string(),
            length: None,
            word_count: None,
            count: None,
            uppercase: None,
            lowercase: None,
            digits: None,
            symbols: None,
            exclude_ambiguous: None,
            custom_symbols: None,
            separator: None,
            pattern: Some("aaa-999".to_string()),
        };
        let result = generate_password(req).unwrap();
        let parts: Vec<&str> = result.password.split('-').collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0].len(), 3);
        assert!(parts[0].chars().all(|c| c.is_ascii_lowercase()));
        assert_eq!(parts[1].len(), 3);
        assert!(parts[1].chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_generate_bulk() {
        let req = PasswordRequest {
            mode: "pin".to_string(),
            length: Some(6),
            word_count: None,
            count: Some(50),
            uppercase: None,
            lowercase: None,
            digits: None,
            symbols: None,
            exclude_ambiguous: None,
            custom_symbols: None,
            separator: None,
            pattern: None,
        };
        let result = generate_bulk(req).unwrap();
        assert_eq!(result.count, 50);
        assert_eq!(result.passwords.len(), 50);
        for p in &result.passwords {
            assert_eq!(p.password.len(), 6);
        }
    }

    #[test]
    fn test_export_passwords_csv() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("passwords.csv");
        let passwords = vec!["pass1".to_string(), "pass2".to_string()];
        let result = export_passwords(passwords, "csv".to_string(), path.to_str().unwrap().to_string()).unwrap();
        let content = std::fs::read_to_string(&result).unwrap();
        assert!(content.contains("password"));
        assert!(content.contains("pass1"));
        assert!(content.contains("pass2"));
    }

    #[test]
    fn test_strength_labels() {
        assert_eq!(strength_label(0.0), "Very Weak");
        assert_eq!(strength_label(30.0), "Weak");
        assert_eq!(strength_label(50.0), "Fair");
        assert_eq!(strength_label(70.0), "Strong");
        assert_eq!(strength_label(100.0), "Very Strong");
        assert_eq!(strength_label(150.0), "Overkill");
    }
}
