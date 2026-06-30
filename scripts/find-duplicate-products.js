require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Brakuje danych Supabase w pliku .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizeName(name = "") {
    return name
        .toLowerCase()
        .replace(/\b(gym high|capsules|caps|powder|servings|serves)\b/g, " ")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractSize(name = "") {
    const match = String(name)
        .toLowerCase()
        .match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);

    if (!match) {
        return null;
    }

    const value = Number(match[1]);
    const unit = match[2];

    if (unit === "kg") {
        return value * 1000;
    }

    if (unit === "l") {
        return value * 1000;
    }

    return value;
}
function similarity(a, b) {
    const wordsA = new Set(normalizeName(a).split(" ").filter(Boolean));
    const wordsB = new Set(normalizeName(b).split(" ").filter(Boolean));

    if (wordsA.size === 0 || wordsB.size === 0) {
        return 0;
    }

    const commonWords = [...wordsA].filter((word) => wordsB.has(word));
    const allWords = new Set([...wordsA, ...wordsB]);

    return commonWords.length / allWords.size;
}

async function findDuplicates() {
    const { data: products, error } = await supabase
        .from("products")
        .select("id, name, slug, gtin, brand")
        .order("name");

    if (error) {
        console.error("Błąd pobierania produktów:", error.message);
        process.exit(1);
    }

    const possibleDuplicates = [];

    for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
            const productA = products[i];
            const productB = products[j];

            if (
                String(productA.brand || "").toLowerCase() !==
                String(productB.brand || "").toLowerCase()
            ) {
                continue;
            }

            const sizeA = extractSize(productA.name);
            const sizeB = extractSize(productB.name);

            if (sizeA !== null && sizeB !== null && sizeA !== sizeB) {
                continue;
            }
            const score = similarity(productA.name, productB.name);

            if (score >= 0.6) {
                possibleDuplicates.push({
                    score,
                    productA,
                    productB,
                });
            }
        }
    }

    possibleDuplicates.sort((a, b) => b.score - a.score);

    if (possibleDuplicates.length === 0) {
        console.log("Nie znaleziono potencjalnych duplikatów.");
        return;
    }

    console.log(
        `Znaleziono ${possibleDuplicates.length} potencjalnych par:\n`
    );

    for (const match of possibleDuplicates) {
        console.log(`Podobieństwo: ${Math.round(match.score * 100)}%`);
        console.log(
            `A: ID ${match.productA.id} | ${match.productA.name} | ${match.productA.gtin || "brak GTIN"}`
        );
        console.log(
            `B: ID ${match.productB.id} | ${match.productB.name} | ${match.productB.gtin || "brak GTIN"}`
        );
        console.log("--------------------------------------------");
    }
}

findDuplicates();