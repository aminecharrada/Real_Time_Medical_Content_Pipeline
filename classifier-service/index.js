const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'classifier-service',
  brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'classifier-group' });
const producer = kafka.producer();

const CATEGORIES = {
  cardiology: ['heart', 'cardiac', 'ecg'],
  oncology: ['cancer', 'tumor', 'chemotherapy'],
  radiology: ['x-ray', 'mri', 'ct scan'],
  neurology: ['brain', 'stroke', 'seizure']
};

async function classify(text) {
  const lowerText = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  return 'general';
}

async function run() {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'incoming-medical-content' });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const content = JSON.parse(message.value.toString());
      const category = await classify(content.text);
      
      await producer.send({
        topic: 'classified-content',
        messages: [{
          value: JSON.stringify({
            ...content,
            category,
            timestamp: new Date().toISOString()
          })
        }]
      });
      
      console.log(`Classified content as: ${category}`);
    }
  });
}

run().catch(console.error);