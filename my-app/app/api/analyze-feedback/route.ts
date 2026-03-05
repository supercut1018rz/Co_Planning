import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { markers } = await request.json();

    // Check OpenAI API Key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Prepare data to send to GPT
    const feedbackData = markers.map((marker: any, index: number) => ({
      number: index + 1,
      description: marker.description,
      location: `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`,
      date: new Date(marker.createdAt).toLocaleDateString(),
      hasImage: !!marker.image
    }));

    // Build prompt (you can modify this later)
    const prompt = `You are an urban planning analyst for Howard County, Maryland. 
Analyze the following citizen feedback about bikeway improvements and infrastructure requests.

Feedback Data (${feedbackData.length} entries):
${JSON.stringify(feedbackData, null, 2)}

Please provide:
1. A summary of the main themes and concerns
2. Geographic patterns or clusters of requests
3. Priority recommendations for the county planning department

IMPORTANT: 
- Format your response as plain text without markdown formatting
- Do NOT use ** for bold, # for headers, or any other markdown syntax
- Use simple line breaks and spacing for organization
- Do NOT include a "Conclusion" section
- Keep the response clear and professional for presentation to local government officials`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert urban planning analyst specializing in bicycle infrastructure and citizen engagement.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate AI analysis', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error in analyze-feedback API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}

