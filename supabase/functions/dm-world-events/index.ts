import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Event templates the DM can choose from — AI picks and customizes
const EVENT_TRIGGERS = [
  { condition: "food < 30", prompt: "The kingdom's food stores are dangerously low. Generate a dramatic event: perhaps a famine, plague of locusts, or a desperate merchant offering food at a steep gold price." },
  { condition: "gold < 20", prompt: "The treasury is nearly empty. Generate an event: perhaps bandits demanding tribute, a tax revolt, or a mysterious benefactor offering gold in exchange for something." },
  { condition: "happiness < 30", prompt: "The populace is miserable. Generate an event: a festival proposal, a religious miracle, or a peasant uprising threatening." },
  { condition: "population > maxPopulation * 0.9", prompt: "The village is overcrowded. Generate an event: refugees arriving, a plague thinning the population, or a noble offering to relocate some villagers." },
  { condition: "totalTroops > 20", prompt: "The army is growing strong. Generate a military event: a border skirmish, barbarian scouts spotted, or a rival lord sending a challenge." },
  { condition: "totalTroops == 0", prompt: "The kingdom is defenseless. Generate an event: bandits raiding the outskirts, wolves attacking farms, or a wandering knight offering service." },
  { condition: "random", prompt: "Generate a random world event for a medieval kingdom: traveling merchants, mysterious ruins discovered, seasonal weather, diplomatic envoys, or supernatural omens." },
];

interface VillageState {
  user_id: string;
  village_name: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  steel: number;
  population: number;
  max_population: number;
  happiness: number;
  totalTroops: number;
  army_militia: number;
  army_archer: number;
  army_knight: number;
}

function pickEventPrompt(v: VillageState): string | null {
  const candidates: string[] = [];

  if (v.food < 30) candidates.push(EVENT_TRIGGERS[0].prompt);
  if (v.gold < 20) candidates.push(EVENT_TRIGGERS[1].prompt);
  if (v.happiness < 30) candidates.push(EVENT_TRIGGERS[2].prompt);
  if (v.population > v.max_population * 0.9) candidates.push(EVENT_TRIGGERS[3].prompt);
  if (v.totalTroops > 20) candidates.push(EVENT_TRIGGERS[4].prompt);
  if (v.totalTroops === 0) candidates.push(EVENT_TRIGGERS[5].prompt);

  // 30% chance of random event even if nothing is triggered
  if (candidates.length === 0 && Math.random() < 0.3) {
    candidates.push(EVENT_TRIGGERS[6].prompt);
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all villages
    const { data: villages, error: vErr } = await supabase.from("villages").select("*");
    if (vErr) throw vErr;
    if (!villages?.length) {
      return new Response(JSON.stringify({ events: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check recent events to avoid spamming (max 1 event per player per 10 min)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentEvents } = await supabase
      .from("world_events")
      .select("user_id")
      .gte("created_at", tenMinAgo);

    const recentUsers = new Set((recentEvents || []).map(e => e.user_id));

    let eventsCreated = 0;

    for (const village of villages) {
      if (recentUsers.has(village.user_id)) continue;

      const totalTroops = (village.army_militia || 0) + (village.army_archer || 0) +
        (village.army_knight || 0) + (village.army_cavalry || 0) +
        (village.army_siege || 0) + (village.army_scout || 0);

      const state: VillageState = {
        user_id: village.user_id,
        village_name: village.name,
        gold: village.gold,
        wood: village.wood,
        stone: village.stone,
        food: village.food,
        steel: village.steel,
        population: village.population,
        max_population: village.max_population,
        happiness: village.happiness,
        totalTroops,
        army_militia: village.army_militia,
        army_archer: village.army_archer,
        army_knight: village.army_knight,
      };

      const eventPrompt = pickEventPrompt(state);
      if (!eventPrompt) continue;

      // Ask AI to generate the event
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are the Dungeon Master of a medieval kingdom game. Generate a world event for the player's kingdom.

Kingdom state: "${state.village_name}" — Gold: ${state.gold}, Wood: ${state.wood}, Stone: ${state.stone}, Food: ${state.food}, Pop: ${state.population}/${state.max_population}, Happiness: ${state.happiness}%, Troops: ${state.totalTroops}

You MUST respond with valid JSON only, no markdown, no backticks. Use this exact format:
{
  "title": "short dramatic event title (max 6 words)",
  "description": "2-3 sentence narrative description in medieval style",
  "event_type": "one of: crisis, opportunity, military, supernatural, trade, weather",
  "effects": {
    "gold": 0, "wood": 0, "stone": 0, "food": 0, "happiness": 0, "population": 0
  }
}

Effects should be small but meaningful: resource changes between -50 and +50, happiness between -10 and +10. Negative effects for crises, positive for opportunities. Make them feel dramatic but balanced.`,
            },
            { role: "user", content: eventPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_world_event",
              description: "Create a world event for the kingdom",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short dramatic event title" },
                  description: { type: "string", description: "Narrative description" },
                  event_type: { type: "string", enum: ["crisis", "opportunity", "military", "supernatural", "trade", "weather"] },
                  effects: {
                    type: "object",
                    properties: {
                      gold: { type: "number" },
                      wood: { type: "number" },
                      stone: { type: "number" },
                      food: { type: "number" },
                      happiness: { type: "number" },
                      population: { type: "number" },
                    },
                    required: ["gold", "wood", "stone", "food", "happiness", "population"],
                  },
                },
                required: ["title", "description", "event_type", "effects"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_world_event" } },
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI error for", village.user_id, aiResponse.status);
        continue;
      }

      const aiData = await aiResponse.json();
      let event: any = null;

      // Extract from tool call
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          event = JSON.parse(toolCall.function.arguments);
        } catch {
          console.error("Failed to parse tool call args");
          continue;
        }
      }

      if (!event) continue;

      // Insert the event
      const { error: insertErr } = await supabase.from("world_events").insert({
        user_id: village.user_id,
        title: event.title,
        description: event.description,
        event_type: event.event_type || "narrative",
        effects: event.effects || {},
        status: "active",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      if (insertErr) {
        console.error("Insert error:", insertErr);
      } else {
        eventsCreated++;
      }
    }

    return new Response(JSON.stringify({ events: eventsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("DM world events error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
