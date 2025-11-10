import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a quantum prediction AI for a prediction market platform. Generate exactly 3 clear, realistic, and human-like future scenarios for the given question.

Each scenario must include:
- title: 2-6 words summarizing the outcome
- desc: One short sentence (10-25 words) explaining why this might happen
- prob: Integer 0-100 for estimated probability (total should sum to ~100)

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "outcomeA": {
    "title": "Short outcome title",
    "desc": "Brief explanation of why this might happen.",
    "prob": 45
  },
  "outcomeB": {
    "title": "Alternative outcome",
    "desc": "Different scenario explanation.",
    "prob": 35
  },
  "outcomeC": {
    "title": "Third possibility",
    "desc": "Another distinct scenario.",
    "prob": 20
  }
}

Example for "Who will win the 2025 Honduras election?":
{
  "outcomeA": {
    "title": "Rixi Moncada Wins",
    "desc": "Strong backing from Libre party and rising popularity in rural departments.",
    "prob": 45
  },
  "outcomeB": {
    "title": "Salvador Nasralla Wins",
    "desc": "Forms a strong alliance with opposition factions and consolidates urban voters.",
    "prob": 35
  },
  "outcomeC": {
    "title": "Other Candidate Wins",
    "desc": "A surprise outsider consolidates youth and anti-establishment support.",
    "prob": 20
  }
}`
          },
          {
            role: "user",
            content: question
          }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway request failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Strip markdown code blocks if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Parse the JSON response from AI
    const scenarios = JSON.parse(cleanContent);

    return new Response(JSON.stringify(scenarios), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-scenarios:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
