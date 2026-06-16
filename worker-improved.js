export default {
  async fetch(request, env) {

    // Handle CORS — allows your React app to call this Worker
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const { prompt } = await request.json()

      if (!prompt || prompt.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'No prompt provided' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
      }

      // Call Gemini API with strict instructions
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an image resize assistant. Extract width and height in pixels from the user's prompt.

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format, with no other text:
{"width": 1080, "height": 1920}

If you cannot extract valid dimensions, respond with:
{"error": "Cannot parse dimensions"}

Examples:
- "resize to 1080x1920" → {"width": 1080, "height": 1920}
- "make it square 500px" → {"width": 500, "height": 500}
- "Instagram story" → {"width": 1080, "height": 1920}

User prompt: "${prompt}"`
              }]
            }]
          })
        }
      )

      if (!geminiRes.ok) {
        throw new Error(`Gemini API error: ${geminiRes.status}`)
      }

      const geminiData = await geminiRes.json()
      
      // Safely extract text from Gemini response
      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
      
      if (!text) {
        console.error('No text in Gemini response:', JSON.stringify(geminiData))
        throw new Error('No response from AI model')
      }

      // Clean and parse JSON
      const clean = text.replace(/```json|```/g, '').trim()
      let dimensions

      try {
        dimensions = JSON.parse(clean)
      } catch (parseErr) {
        console.error('JSON parse error:', clean)
        throw new Error('AI response was not valid JSON')
      }

      // Check for error response from AI
      if (dimensions.error) {
        throw new Error(dimensions.error)
      }

      // Validate dimensions
      if (!dimensions.width || !dimensions.height) {
        throw new Error('Missing width or height in response')
      }

      if (typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number') {
        throw new Error('Width and height must be numbers')
      }

      if (dimensions.width < 10 || dimensions.height < 10 || dimensions.width > 10000 || dimensions.height > 10000) {
        throw new Error('Dimensions out of valid range (10-10000px)')
      }

      return new Response(JSON.stringify(dimensions), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })

    } catch (err) {
      console.error('Worker error:', err.message)
      
      return new Response(
        JSON.stringify({ 
          error: err.message || 'Failed to parse prompt. Try: "1080x1920", "square 500px", or "Instagram story"'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }
  }
}
