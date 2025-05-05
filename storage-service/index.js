const express = require('express');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');

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
  timestamp: String
});
const Content = mongoose.model('Content', contentSchema);

// Kafka Consumer
const kafka = new Kafka({
  clientId: 'storage-service',
  brokers: ['localhost:9092']
});
const consumer = kafka.consumer({ groupId: 'storage-group' });

async function runConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'classified-content' });
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      const content = JSON.parse(message.value.toString());
      await Content.create(content);
      console.log('Stored content:', content.category);
    }
  });
}

runConsumer().catch(console.error);

// REST API
app.get('/api/contents', async (req, res) => {
  const contents = await Content.find();
  res.json(contents);
});

app.listen(8001, () => {
  console.log('Storage Service running on http://localhost:8001');
});