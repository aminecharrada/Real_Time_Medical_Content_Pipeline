const express = require('express');
const mongoose = require('mongoose');
// const { Kafka } = require('kafkajs'); // Kafka client is already in kafka-config
const { kafka, TOPICS } = require('../config/kafka-config'); // Use shared config
const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/medical')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schema
const contentSchema = new mongoose.Schema({
  text: String,
  metadata: Object,
  category: String,
  timestamp: String,
  lm_enhancement: String, 
  storedAt: Date 
});
const Content = mongoose.model('Content', contentSchema);

// Kafka Consumer
const consumer = kafka.consumer({
  groupId: 'storage-group',
  heartbeatInterval: 3000,
  sessionTimeout: 30000
});

async function runConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.CLASSIFIED, fromBeginning: false }); // fromBeginning: false is good for new messages

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ message }) => {
      try {
        const contentData = JSON.parse(message.value.toString()); // Renamed variable
        // Ensure 'storedAt' is set if it's part of the schema and not in the message
        await Content.create({
          ...contentData,
          storedAt: new Date() // This will override if contentData has storedAt, or add it
        });
        console.log('Stored content with ID:', contentData.id || 'N/A (using _id from mongo)');
      } catch (error) {
        console.error('Storage error:', error);
        // Add dead-letter queue logic here if needed
        // For example, publish to TOPICS.ERRORS
      }
    }
  });
}

runConsumer().catch(err => {
    console.error("Error running storage consumer:", err);
    process.exit(1);
});

// REST API
app.get('/api/contents', async (req, res) => {
  try {
    const contents = await Content.find();
    res.json(contents.map(doc => ({
      id: doc._id.toString(),
      text: doc.text || "", 
      category: doc.category || "uncategorized", 
      timestamp: doc.timestamp || new Date().toISOString(), 
      metadata: doc.metadata || {},
      lm_enhancement: doc.lm_enhancement || "Not available"
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(8001, () => {
  console.log('Storage Service running on http://localhost:8001');
});