import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_SECRET = "els_super_secret_admin_key_2026";
const OPENAI_API_BASE = "https://api.openai.com/v1/chatkit/threads";
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

interface ChatKitThread {
  id: string;
  title?: string;
  created_at?: number;
  metadata?: Record<string, string | undefined>;
}

interface ChatKitItem {
  id: string;
  type: string;
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  created_at?: number;
}

/**
 * Extracts plain text from a ChatKit item's content field,
 * which may be a string or an array of content parts.
 */
function extractText(content: ChatKitItem["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        return "";
      })
      .join("\n");
  }
  return "";
}

/**
 * GET /api/sync/threads
 *
 * Query params:
 *   tier   – tier1 | tier2 | tier3  (optional, default tier1)
 *   limit  – max threads to fetch   (optional, default 50)
 *
 * Requires header: x-admin-secret: els_super_secret_admin_key_2026
 */
export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const secret = request.headers.get("x-admin-secret");
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  // ── Parse params ──────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const tier = searchParams.get("tier") || "tier1";
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);

  const supabase = getSupabaseAdmin();
  let synced = 0;
  let errors = 0;
  const details: string[] = [];

  try {
    // ── 1. Fetch threads from ChatKit API ──────────────────────
    const threadsRes = await fetch(
      `${OPENAI_API_BASE}?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "chatkit_beta=v1",
        },
      }
    );

    if (!threadsRes.ok) {
      const text = await threadsRes.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${threadsRes.status}`, body: text },
        { status: 502 }
      );
    }

    const threadsBody = await threadsRes.json();
    const threads: ChatKitThread[] = threadsBody.data ?? threadsBody ?? [];

    // ── 2. Process each thread ─────────────────────────────────
    for (const thread of threads) {
      try {
        const meta = thread.metadata ?? {};

        const title =
          meta.title || meta.thread_title || thread.title || "(untitled)";
        const userId = meta.user || meta.user_id || DEFAULT_USER_ID;
        const threadTier = meta.tier || tier;
        const status = meta.status || "open";
        const category = meta.category || null;

        // Upsert conversation row (keyed on thread_id)
        const { data: convoData, error: convoErr } = await supabase
          .from("conversations")
          .upsert(
            {
              thread_id: thread.id,
              title,
              user_id: userId,
              tier: threadTier,
              status,
              category,
              created_at: thread.created_at
                ? new Date(thread.created_at * 1000).toISOString()
                : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "thread_id" }
          )
          .select("id")
          .single();

        if (convoErr) {
          console.error(
            `Upsert conversation failed for thread ${thread.id}:`,
            convoErr
          );
          errors++;
          details.push(`conv-err:${thread.id} ${convoErr.message}`);
          continue;
        }

        const conversationId = convoData.id;

        // ── 3. Fetch thread items (messages) ───────────────────
        const itemsRes = await fetch(
          `${OPENAI_API_BASE}/${thread.id}/items?limit=100`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "OpenAI-Beta": "chatkit_beta=v1",
            },
          }
        );

        if (!itemsRes.ok) {
          console.error(
            `Fetch items failed for thread ${thread.id}: ${itemsRes.status}`
          );
          errors++;
          details.push(`items-err:${thread.id} status=${itemsRes.status}`);
          continue;
        }

        const itemsBody = await itemsRes.json();
        const items: ChatKitItem[] = itemsBody.data ?? itemsBody ?? [];

        // Filter to actual messages only
        const messages = items.filter(
          (item) => item.type !== "chatkit.task_group"
        );

        // Preserve rows written by /api/chat — those carry token_usage,
        // safety_class, retrieved_sources, response_id that power the
        // Cost / Safety / KB-Utilization dashboards. ChatKit's thread
        // items don't expose those fields, so a naive delete+reinsert
        // clobbered them on every sync.
        //
        // If the conversation already has at least one row with
        // token_usage populated, skip syncing — the /api/chat path has
        // authoritative (richer) data.
        const { data: enriched, error: enrichedErr } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .not("token_usage", "is", null)
          .limit(1);

        if (enrichedErr) {
          errors++;
          details.push(`enrichment-check-err:${conversationId} ${enrichedErr.message}`);
          continue;
        }

        if (enriched && enriched.length > 0) {
          // Already have rich data — skip clobbering.
          synced++;
          details.push(`skipped-sync:${conversationId} (already enriched)`);
          continue;
        }

        // No enriched data for this conversation — safe to refresh from
        // ChatKit as the source of truth.
        await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", conversationId);

        for (const msg of messages) {
          const text = extractText(msg.content);
          if (!text) continue;

          const { error: msgErr } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: msg.role || "unknown",
            content: text,
            created_at: msg.created_at
              ? new Date(msg.created_at * 1000).toISOString()
              : new Date().toISOString(),
          });

          if (msgErr) {
            console.error(
              `Insert message failed for ${msg.id}:`,
              msgErr
            );
            errors++;
            details.push(`msg-err:${msg.id} ${msgErr.message}`);
          }
        }

        synced++;
      } catch (threadErr: unknown) {
        const errMsg =
          threadErr instanceof Error ? threadErr.message : String(threadErr);
        console.error(`Error processing thread ${thread.id}:`, errMsg);
        errors++;
        details.push(`thread-err:${thread.id} ${errMsg}`);
      }
    }

    return NextResponse.json({
      synced,
      errors,
      total_threads: threads.length,
      tier,
      ...(details.length > 0 ? { details } : {}),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Sync failed:", errMsg);
    return NextResponse.json(
      { error: errMsg, synced, errors },
      { status: 500 }
    );
  }
}
