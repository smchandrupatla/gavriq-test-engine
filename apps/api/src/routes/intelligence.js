/**
 * Intelligence routes for AI-powered features
 */
import { FastifyInstance } from 'fastify';

export async function intelligenceRoutes(fastify: FastifyInstance) {
  fastify.post('/generate-test-case', async (request, reply) => {
    const { prompt, max_length = 200 } = request.body as { prompt: string; max_length?: number };

    if (!prompt) {
      return reply.status(400).send({ error: 'Prompt is required' });
    }

    try {
      // Use Hugging Face Inference API with a free NVIDIA model
      const modelId = process.env.HF_MODEL_ID || 'nvidia/nemotron-3-8b-base-4k';
      const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;
      const hfToken = process.env.HF_TOKEN;

      if (!hfToken) {
        // Fallback to a simple mock response for development
        return reply.send({
          generated_text: `// Generated test case for: ${prompt}\n// Note: Set HF_TOKEN environment variable to use AI model\nimport { test, expect } from '@playwright/test';\n\ntest('${prompt}', async ({ page }) => {\n  // TODO: Implement test steps\n  await page.goto('/');\n  expect(page).toHaveTitle(/.*/);\n});`
        });
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_new_tokens: max_length }
        })
      });

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const result = await response.json();
      const generatedText = Array.isArray(result) ? result[0]?.generated_text : result.generated_text;

      reply.send({ generated_text: generatedText });
    } catch (error) {
      fastify.log.error('Error generating test case:', error);
      reply.status(500).send({ error: 'Failed to generate test case' });
    }
  });
}