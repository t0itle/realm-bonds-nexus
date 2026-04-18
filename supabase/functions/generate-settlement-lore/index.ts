import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BurgInfo {
  burg_id: number;
  burg_name: string;
  state_id: number;
  state_name: string;
  culture_name: string;
  burg_type: string;
  population: number;
  has_walls: boolean;
  has_port: boolean;
  has_temple: boolean;
  has_citadel: boolean;
  is_capital: boolean;
}

const LORE_TOOL = {
  type: "function",
  function: {
    name: "compose_settlement_lore",
    description: "Compose ruler, dynasty, lineage, kingdom hierarchy, and history for a fantasy settlement.",
    parameters: {
      type: "object",
      properties: {
        ruler_name: { type: "string", description: "Full name of the current ruler." },
        ruler_title: { type: "string", description: "Title (e.g. 'Baroness', 'Lord-Mayor', 'High King')." },
        dynasty_name: { type: "string", description: "House/dynasty name (e.g. 'House Vorenwyck')." },
        lineage: {
          type: "array",
          description: "3-5 ancestors of the current ruler in chronological order, oldest first.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              title: { type: "string" },
              note: { type: "string", description: "1-sentence biographical note." },
            },
            required: ["name", "title", "note"],
          },
        },
        kingdom_hierarchy: {
          type: "object",
          description: "Chain of command above this settlement's ruler.",
          properties: {
            sovereign: { type: "string", description: "Top of the realm (e.g. 'King Arric Thallowmere of the Sablecrown')." },
            sovereign_seat: { type: "string", description: "Capital city of the sovereign." },
            liege: { type: "string", description: "Direct overlord above this settlement's ruler. May equal sovereign for capitals." },
            liege_title: { type: "string" },
            this_ruler_rank: { type: "string", description: "Where this ruler sits in the hierarchy." },
          },
          required: ["sovereign", "sovereign_seat", "liege", "liege_title", "this_ruler_rank"],
        },
        settlement_history: { type: "string", description: "2-3 sentences on the settlement's founding and a defining historical event." },
        ruler_personality: { type: "string", description: "1-2 sentences on the ruler's demeanor, ambitions, and fears." },
        notable_facts: {
          type: "array",
          description: "2-4 short pieces of local color (rumours, customs, exports, hauntings).",
          items: { type: "string" },
        },
      },
      required: [
        "ruler_name",
        "ruler_title",
        "dynasty_name",
        "lineage",
        "kingdom_hierarchy",
        "settlement_history",
        "ruler_personality",
        "notable_facts",
      ],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: BurgInfo = await req.json();
    if (typeof body?.burg_id !== "number" || !body?.burg_name) {
      return new Response(JSON.stringify({ error: "burg_id and burg_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Return cached lore if present
    const { data: existing } = await supabase
      .from("npc_settlement_lore")
      .select("*")
      .eq("burg_id", body.burg_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ lore: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const features: string[] = [];
    if (body.is_capital) features.push("the capital seat");
    if (body.has_walls) features.push("walled");
    if (body.has_port) features.push("a major port");
    if (body.has_temple) features.push("home to a great temple");
    if (body.has_citadel) features.push("crowned by a citadel");

    const userPrompt = `Compose lore for the settlement "${body.burg_name}" in the realm of "${body.state_name}".
Culture: ${body.culture_name || "unknown"}. Settlement type: ${body.burg_type || "town"}. Population: ${body.population}.
Notable: ${features.length ? features.join(", ") : "an ordinary holding"}.
Make the ruler's name and dynasty fit the culture. Give a clear hierarchy: who rules the kingdom above this settlement's ruler, and where this ruler stands in that chain.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a worldbuilder writing concise, evocative fantasy lore for a strategy game. Names should sound period-appropriate and culture-flavored. Be specific, not generic.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [LORE_TOOL],
        tool_choice: { type: "function", function: { name: "compose_settlement_lore" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Top up to continue generating lore." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("AI returned no tool call");

    const parsed = JSON.parse(toolCall.function.arguments);

    const insertRow = {
      burg_id: body.burg_id,
      burg_name: body.burg_name,
      state_id: body.state_id,
      state_name: body.state_name,
      ruler_name: parsed.ruler_name,
      ruler_title: parsed.ruler_title,
      dynasty_name: parsed.dynasty_name,
      lineage: parsed.lineage ?? [],
      kingdom_hierarchy: parsed.kingdom_hierarchy ?? {},
      settlement_history: parsed.settlement_history,
      ruler_personality: parsed.ruler_personality,
      notable_facts: parsed.notable_facts ?? [],
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("npc_settlement_lore")
      .upsert(insertRow, { onConflict: "burg_id" })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ lore: inserted, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-settlement-lore error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
