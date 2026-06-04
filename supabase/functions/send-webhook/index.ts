// Supabase Edge Function: send-webhook
// Proxy server-side para enviar webhooks com Content-Type application/json
// Resolve o bloqueio de CORS do Power Automate (Teams) quando chamado direto do browser.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { webhookUrl, message, type } = await req.json();

    if (!webhookUrl || !message || !type) {
      return new Response(
        JSON.stringify({ ok: false, error: 'webhookUrl, message e type são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: string;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (type === 'teams') {
      const lines = (message as string).split('\n');
      const title = lines[0].replace(/<[^>]*>/g, '').trim();
      const bodyText = lines.slice(1).join('\n').trim();

      const cardBody: object[] = [
        {
          type: 'TextBlock',
          text: title,
          weight: 'bolder',
          size: 'medium',
          wrap: true,
          color: 'accent',
        },
      ];

      if (bodyText) {
        cardBody.push({
          type: 'TextBlock',
          text: bodyText,
          wrap: true,
          spacing: 'small',
        });
      }

      body = JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              type: 'AdaptiveCard',
              body: cardBody,
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              version: '1.2',
            },
          },
        ],
      });
    } else if (type === 'discord') {
      body = JSON.stringify({
        content: message,
        username: 'Agenda 103Ki',
      });
    } else if (type === 'slack') {
      body = JSON.stringify({ text: message });
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: `Tipo desconhecido: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upstream = await fetch(webhookUrl, { method: 'POST', headers, body });

    return new Response(
      JSON.stringify({ ok: upstream.ok, status: upstream.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
