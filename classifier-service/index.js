// ... other imports
const { kafka, TOPICS } = require('../config/kafka-config');
const { Partitioners } = require('kafkajs');
const axios = require('axios');

// Initialize Kafka consumer and producer
const consumer = kafka.consumer({
  groupId: 'classifier-group',
  sessionTimeout: 90000, // Increased to 90 seconds
  heartbeatInterval: 25000, // Increased to 25 seconds (must be < sessionTimeout / 3)
  maxBytesPerPartition: 1048576 // 1MB
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});

// Medical classification rules
const CATEGORIES = {
  cardiology: ['heart', 'cardiac', 'ecg'],
  oncology: ['cancer', 'tumor', 'chemotherapy'],
  radiology: ['x-ray', 'mri', 'ct scan'],
  // Consider adding 'neurology', 'headache', 'vision' if you want these to be neurology
  neurology: ['brain', 'stroke', 'seizure', 'neurology', 'neurological']
};

// LM Studio Configuration
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';
// CORRECTED based on your LM Studio screenshot's "API Identifier"
const LM_STUDIO_MODEL_ID = 'deepseek-r1-distill-qwen-7b';

// Classification function
function classifyContent(text) {
  const lowerText = (text || "").toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  return 'general';
}

// Function to call LM Studio
async function enhanceWithLM(text) {
  if (!text || text.trim() === "") {
    console.log("Skipping LM enhancement for empty text.");
    return "No text provided for enhancement.";
  }
  try {
    console.log(`Sending text to LM Studio for enhancement: "${text.substring(0, 100)}..." (Model ID: ${LM_STUDIO_MODEL_ID})`);
    const response = await axios.post(LM_STUDIO_URL, {
      model: LM_STUDIO_MODEL_ID, // Use the corrected model ID
      messages: [
        {
          role: "system",
          content: "You are a concise medical text analyzer. Your task is to extract key medical information or provide a brief summary from the user's text. Output ONLY the analysis or summary. DO NOT include conversational phrases, introductory remarks, apologies, or any form of self-reflection or thinking process (e.g., no '<think>', 'Okay, so...', 'I need to...'). If you have a thinking block like <think>...</think>, ensure the actual medical analysis is provided AFTER the closing </think> tag."
        },
        { role: "user", content: `Analyze the following medical text: "${text}"` }
      ],
      temperature: 0.3, // Lowered temperature for more deterministic output
      max_tokens: 300,  // Max tokens (seems okay, finish_reason was 'stop')
      stream: false
    });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      let enhancement = response.data.choices[0].message.content.trim();
      console.log("Raw LM Studio enhancement received:", enhancement);

      // Refined post-processing:
      // Priority 1: Extract content AFTER </think> if present.
      const thinkEndTag = "</think>";
      const thinkEndIndex = enhancement.indexOf(thinkEndTag);

      if (thinkEndIndex !== -1) {
        enhancement = enhancement.substring(thinkEndIndex + thinkEndTag.length).trim();
        console.log("Content after </think> stripping:", enhancement);
      } else {
        // Priority 2: If no </think>, try removing common self-correction/thinking prefixes.
        // This is a fallback, as the model seems to use <think> reliably.
        const thinkingPatterns = [
            /^<think>[\s\S]*?<\/think>\s*/i, // Should be caught by the above, but as a backup
            /^okay, so i need to .*?\.\s*/i,
            /^alright, so i need to .*?\.\s*/i,
            /^looking at the provided medical text:.*?[\r\n]+/i,
            /^first, i need to break this down.*?[\r\n]+/i,
            /^\w+\s*?, so I need to .*?[\r\n]+/i
        ];
        for (const pattern of thinkingPatterns) {
            enhancement = enhancement.replace(pattern, "");
        }
        enhancement = enhancement.trim();
        console.log("Content after regex pattern cleanup (if no </think>):", enhancement);
      }
      
      // Final cleanup of any remaining common conversational prefixes on the extracted part
      const prefixesToRemove = ["okay, so ", "alright, so ", "okay, let's see. ", "summary: ", "analysis: "];
      for (const prefix of prefixesToRemove) {
          if (enhancement.toLowerCase().startsWith(prefix.toLowerCase())) {
              enhancement = enhancement.substring(prefix.length).trim();
          }
      }
      
      enhancement = enhancement.trim();
      // Capitalize the first letter if not empty
      if (enhancement.length > 0) {
        enhancement = enhancement.charAt(0).toUpperCase() + enhancement.slice(1);
      }

      console.log("Cleaned LM Studio enhancement:", enhancement);
      return enhancement || "LM processing resulted in empty content after cleanup.";
    } else {
      console.warn('LM Studio response format unexpected:', response.data);
      return "LM enhancement failed: Unexpected response format.";
    }
  } catch (error) {
    if (error.response) {
      console.error(`Error calling LM Studio API (Model: ${LM_STUDIO_MODEL_ID}):`, error.response.status, error.response.data);
      // Check if error.response.data contains specific model loading error from LM Studio
      if (error.response.data && error.response.data.error && error.response.data.error.message) {
        console.error("LM Studio Error Message:", error.response.data.error.message);
        if (error.response.data.error.message.includes("Could not find model")) {
            return `LM enhancement failed: Model ID '${LM_STUDIO_MODEL_ID}' not found or not loaded in LM Studio. Please verify.`;
        }
      }
    } else {
      console.error(`Error calling LM Studio API (Model: ${LM_STUDIO_MODEL_ID}):`, error.message);
    }
    return `LM enhancement failed due to API error. Check classifier-service logs and LM Studio server logs.`;
  }
}

// Main processing function
async function run() {
  try {
    await Promise.all([
      producer.connect(),
      consumer.connect()
    ]);
    console.log('Kafka connections established');

    await consumer.subscribe({
      topic: TOPICS.INCOMING,
      fromBeginning: false // Set to true to reprocess for testing, then false
    });

    console.log('Consumer subscribed. Waiting for messages...');

    await consumer.run({
      partitionsConsumedConcurrently: 1,
      eachMessage: async ({ topic, partition, message }) => {
        console.log(`\nReceived message: Topic ${topic}, Partition ${partition}, Offset ${message.offset}`);
        if (!message.value) {
          console.warn('Received empty message value');
          return;
        }

        let parsedContent;
        try {
          parsedContent = JSON.parse(message.value.toString());
          const originalText = parsedContent.text || "";
          console.log('Processing content:', originalText ? originalText.substring(0, 50) + '...' : "No text in content");

          const category = classifyContent(originalText);
          let lmEnhancement = "Not processed by LM.";

          if (originalText) {
            lmEnhancement = await enhanceWithLM(originalText);
          } else {
            console.warn("No text found in content to send to LM Studio.");
          }

          await producer.send({
            topic: TOPICS.CLASSIFIED,
            messages: [{
              value: JSON.stringify({
                ...parsedContent,
                category,
                lm_enhancement: lmEnhancement,
                classifiedAt: new Date().toISOString()
              }),
              headers: {
                ...message.headers,
                'processed-by': 'classifier-lm-v3', // Version bump
                'original-offset': message.offset.toString()
              }
            }]
          });

          console.log(`Successfully classified as: ${category}. LM enhancement: ${lmEnhancement.substring(0, 70)}...`);
        } catch (error) {
          console.error(`Error processing message from offset ${message.offset}:`, error);
        }
      }
    });
  } catch (error) {
    console.error('Kafka run error:', error);
    process.exit(1);
  }
}

// ... (SIGTERM handling) ...

run().catch(error => {
  console.error('Service failed to start:', error);
  process.exit(1);
});