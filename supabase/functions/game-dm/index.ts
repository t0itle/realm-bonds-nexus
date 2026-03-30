import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Dungeon Master (DM) of a medieval kingdom-building strategy game called "Realm Bonds". You speak in a dramatic, medieval fantasy style — wise, sometimes ominous, sometimes encouraging. Keep responses SHORT (2-4 sentences max).

You monitor the player's kingdom stats and provide:
- Warnings about crises (low food, bankruptcy, unhappy populace)
- Celebration of milestones (population growth, building upgrades, military victories)
- Strategic advice when asked
- Lore and narrative flavor about events
- Quest-like suggestions based on current state

When given game state data, analyze it and respond as a living narrator would. Reference specific numbers naturally.
Never break character. You ARE the realm's oracle.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages, gameState, type } = await req.json();

    // Build context from game state
    let stateContext = "";
    if (gameState) {
      const g = gameState;
      stateContext = `\n\n[CURRENT KINGDOM STATE]
Village: "${g.villageName}" | Level: ${g.playerLevel}
Resources — Gold: ${g.gold}, Wood: ${g.wood}, Stone: ${g.stone}, Food: ${g.food}, Steel: ${g.steel}
Population: ${g.population}/${g.maxPopulation} | Happiness: ${g.happiness}%
Tax Rate: ${g.taxRate}% | Rations: ${g.rations}
Army — Militia: ${g.militia}, Archers: ${g.archers}, Knights: ${g.knights}, Cavalry: ${g.cavalry}, Siege: ${g.siege}, Scouts: ${g.scouts}
Buildings: ${g.buildings || "unknown"}
Total troops: ${g.totalTroops}`;
    }

    const systemWithState = SYSTEM_PROMPT + stateContext;

    // For event triggers, generate a brief narration
    const finalMessages = type === "event"
      ? [
          { role: "system", content: systemWithState },
          { role: "user", content: messages[0]?.content || "Narrate the current state of the kingdom." },
        ]
      : [
          { role: "system", content: systemWithState },
          ...messages,
        ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "The oracle is overwhelmed. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "The oracle's power has been depleted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "The oracle is silent..." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("DM error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
