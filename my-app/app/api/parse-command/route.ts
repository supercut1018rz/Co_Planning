import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
  baseURL: (process.env.OPENAI_BASE_URL || '').trim() || undefined,
});


/**
 * API Route: Natural language command parsing
 * POST /api/parse-command
 *
 * Input: { command: "Add a sidewalk along Main Street..." }
 * Output: structured ParsedCommand JSON
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command } = body;

    console.log('📝 Received command:', command);

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Command text is required' },
        { status: 400 }
      );
    }

    // Check OpenAI API key existence (do not print it)
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { success: false, error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a natural language parser specialized in processing urban planning and transportation infrastructure commands.
Your task is to convert users' natural language commands into structured JSON format.

Users might say:
- "Add a sidewalk along Main Street between US-29 and Broken Land Pkwy"
- "Add a sidewalk on the east side of Broken Land Parkway from intersection A to intersection B"
- "Add a sidewalk on the north side of Route 175 near Columbia Mall"

You need to extract the following information and return JSON (if the user provides start/end latitude and longitude directly, fill in the lat/lon for from/to, and set type to "coordinate"):
{
  "feature_type": "sidewalk" | "bike_lane" | "crosswalk",
  "county": "Howard County",
  "street_name": "street name if mentioned",
  "side": "left" | "right" | "north" | "south" | "east" | "west" | "both",
  "width_m": number (default 1.5 for sidewalk),
  "from": {
    "type": "intersection" | "coordinate" | "landmark",
    "street": "cross street name",
    "lat": number,
    "lon": number,
    "landmark": "landmark name"
  },
  "to": {
    "type": "intersection" | "coordinate" | "landmark",
    "street": "cross street name",
    "lat": number,
    "lon": number,
    "landmark": "landmark name"
  },
  "properties": {
  }
}

Important rules:
1. If from/to are not explicitly mentioned, these fields can be omitted
2. Default county is "Howard County"
3. If side is not explicitly specified, this field can be omitted
4. Only return JSON, no other text

Example input: "Add a sidewalk along Broken Land Parkway from Little Patuxent Parkway to Cradlerock Way on the east side"
Example output:
{
  "feature_type": "sidewalk",
  "county": "Howard County",
  "street_name": "Broken Land Parkway",
  "side": "east",
  "width_m": 1.5,
  "from": {
    "type": "intersection",
    "street": "Little Patuxent Parkway"
  },
  "to": {
    "type": "intersection",
    "street": "Cradlerock Way"
  }
}`;

    console.log('🤖 Calling OpenAI API...');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: command },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    console.log('✅ OpenAI API call successful');

    const responseText = completion.choices?.[0]?.message?.content;

    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (jsonErr: any) {
      console.error('❌ Failed to JSON.parse OpenAI response:', {
        message: jsonErr?.message,
        responseTextPreview: responseText.slice(0, 500),
      });
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI returned invalid JSON. Check prompt/response_format.',
          raw: responseText,
        },
        { status: 502 }
      );
    }

    console.log('📋 Parsed result:', JSON.stringify(parsed, null, 2));

    return NextResponse.json({
      success: true,
      parsed,
      raw_command: command,
    });
  } catch (err: any) {
    // --- Diagnostic logging (safe) ---
    const key = process.env.OPENAI_API_KEY || '';
    console.error('❌ Error parsing command');

    // Print only safe key metadata (never print full key)
    console.error('Key diagnostics:', {
      hasKey: !!key,
      keyLen: key.length,
      keyTail4: key.slice(-4),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      nodeEnv: process.env.NODE_ENV,
    });

    // openai-node structured error details
    if (err instanceof OpenAI.APIError) {
      console.error('OpenAI.APIError details:', {
        status: err.status,
        name: err.name,
        message: err.message,
        request_id: err.request_id,
        headers: err.headers,
        // Some additional fields (may or may not exist depending on version)
        api_error: (err as any).error,
        type: (err as any).type,
        code: (err as any).code,
        param: (err as any).param,
      });
    } else {
      console.error('Non-OpenAI error details:', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        status: err?.status,
        code: err?.code,
        response: err?.response,
      });
    }

    // --- User-facing message + proper status passthrough ---
    const status =
      err instanceof OpenAI.APIError && err.status
        ? err.status
        : typeof err?.status === 'number'
          ? err.status
          : 500;

    let errorMessage = err?.message || 'Failed to parse command';

    // Prefer OpenAI error object if present
    const apiErrorObj = err instanceof OpenAI.APIError ? (err as any).error : undefined;
    const apiErrorMsg =
      apiErrorObj?.message ||
      apiErrorObj?.error?.message ||
      undefined;

    if (apiErrorMsg) {
      errorMessage = apiErrorMsg;
    }

    if (status === 401) {
      errorMessage =
        'OpenAI auth failed (401). Possible causes: wrong/disabled key, key not loaded, hidden spaces/newlines, or org/project mismatch. Check server logs for request_id and api_error.';
    } else if (status === 429) {
      errorMessage =
        'OpenAI rate/quota limited (429). Check billing/limits and retry later.';
    } else if ((err as any)?.code === 'insufficient_quota') {
      errorMessage =
        'OpenAI API quota exceeded. Please check your billing/limits.';
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        // Helpful for debugging across logs without exposing secrets
        request_id: err instanceof OpenAI.APIError ? err.request_id : undefined,
        status,
      },
      { status }
    );
  }
}
