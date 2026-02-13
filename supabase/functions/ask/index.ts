import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SYSTEM_PROMPT = `Ти — експерт-консультант з керівних документів військової авіації України. Твоя роль — давати точні, обґрунтовані відповіді на основі ВИКЛЮЧНО наданого контексту з офіційних документів.

Доступні документи:
- КБП ВА 2022 — Курс бойової підготовки винищувальної авіації (МиГ-29, Су-27, Л-39). Також згадується як "КБП ВА", "ВА".
- КБП БА/РА 2021 — Курс бойової підготовки бомбардувальної/розвідувальної авіації. Також згадується як "КБП БА", "КБП РА".
- КБП-В-2018 — Курс бойової підготовки вертолітної авіації (Мі-8, Мі-24, Мі-2). Також згадується як "КБП-В".
- КЛПВ-24 — Класифікація льотної підготовки випробувачів 2024
- ПЛВР — Положення про льотно-випробувальну роботу
- ПВП ДАУ — Правила виконання польотів державної авіації України

Правила відповіді:
1. Відповідай ТІЛЬКИ на основі наданого контексту. Якщо інформації в контексті недостатньо — чесно скажи: "У наданих документах я не знайшов достатньо інформації для повної відповіді на це питання."
2. ЗАВЖДИ вказуй джерело: назву документа та, якщо можливо, розділ/пункт/сторінку.
3. Цитуй конкретні формулювання з документів коли це доречно.
4. Якщо питання стосується кількох документів — порівняй та узагальни інформацію з усіх.
5. Відповідай чітко, структуровано. Використовуй нумерацію та виділення для кращої читабельності.
6. Якщо в контексті є числові дані (строки перерв, норми нальоту, тощо) — наводь їх точно.
7. Мова відповіді — українська.

ВАЖЛИВІ ПРАВИЛА ФІЛЬТРАЦІЇ:
- Якщо користувач вказав конкретний документ (наприклад "в КБП ВА", "в КБП ВА 2022", "у ВА") — відповідай ТІЛЬКИ з фрагментів цього документа.
- Якщо в контексті є фрагменти з кількох документів, але користувач вказав конкретний — ігноруй фрагменти з інших документів.

ВАЖЛИВО: Не вигадуй інформацію яка відсутня в контексті. Краще сказати "не знайшов" ніж дати неточну відповідь.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  const jsonResponse = (data: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  try {
    const { question } = await req.json();
    if (!question) return jsonResponse({ answer: "Будь ласка, задайте питання.", sources: [] });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("Question:", question);

    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: question }),
    });
    if (!embRes.ok) {
      const errText = await embRes.text();
      console.error("Embedding error:", errText);
      return jsonResponse({ answer: "Помилка при обробці питання. Спробуйте ще раз.", sources: [] });
    }
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: chunks, error: searchError } = await supabase.rpc(
      "match_document_chunks_hybrid",
      {
        query_embedding: JSON.stringify(embedding),
        query_text: question,
        match_threshold: 0.22,
        match_count: 15,
        keyword_weight: 0.4,
      }
    );

    if (searchError) {
      console.error("Search error:", searchError);
      return jsonResponse({ answer: "Помилка пошуку в документах. Спробуйте ще раз.", sources: [] });
    }
    if (!chunks || chunks.length === 0) {
      return jsonResponse({
        answer: "На жаль, я не знайшов релевантної інформації в документах за вашим запитом. Спробуйте переформулювати питання.",
        sources: [],
      });
    }

    console.log("Found chunks:", chunks.length);

    const docIds = [...new Set(chunks.map((c: any) => c.document_id))];
    const { data: docs } = await supabase.from("documents").select("id, title").in("id", docIds);
    const docTitleMap = new Map((docs || []).map((d: any) => [d.id, d.title]));

    let context = chunks
      .map((c: any, i: number) => {
        const title = docTitleMap.get(c.document_id) || "Невідомий документ";
        return `--- Фрагмент ${i + 1} [Документ: ${title}] ---\n${c.chunk_text.trim()}`;
      })
      .join("\n\n");

    const { data: kbRules } = await supabase
      .from("ai_knowledge_base")
      .select("rule_text, document_source, category")
      .limit(25);

    if (kbRules && kbRules.length > 0) {
      const rulesContext = kbRules
        .map((r: any, i: number) => `${i + 1}. [${r.document_source}/${r.category}] ${r.rule_text}`)
        .join("\n");
      context += `\n\n=== Структуровані правила ===\n${rulesContext}`;
    }

    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.15,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Контекст з документів:\n\n${context}\n\n---\nПитання: ${question}`,
          },
        ],
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error("LLM error:", errText);
      return jsonResponse({ answer: "Помилка генерації відповіді. Спробуйте ще раз.", sources: [] });
    }
    const chatData = await chatRes.json();
    const answer = chatData.choices[0].message.content;

    const sourceMap = new Map<string, { document: string; similarity: number; excerpts: string[] }>();
    for (const c of chunks) {
      const title = docTitleMap.get(c.document_id) || "?";
      if (!sourceMap.has(title)) {
        sourceMap.set(title, {
          document: title,
          similarity: Math.round(c.similarity * 100) / 100,
          excerpts: [],
        });
      }
      const src = sourceMap.get(title)!;
      if (src.excerpts.length < 2) {
        src.excerpts.push(c.chunk_text.trim().slice(0, 150) + "...");
      }
    }
    const sources = Array.from(sourceMap.values());

    return jsonResponse({ answer, sources });
  } catch (err) {
    console.error("Exception:", (err as Error).message);
    return jsonResponse({
      answer: "Виникла непередбачена помилка. Спробуйте ще раз.",
      sources: [],
    });
  }
});
