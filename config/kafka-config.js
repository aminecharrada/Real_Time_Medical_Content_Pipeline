const { Kafka, Partitioners } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'medical-pipeline',
  brokers: ['localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

module.exports = {
  kafka,
  TOPICS: {
    INCOMING: 'incoming-medical-content',
    CLASSIFIED: 'classified-content',
    ERRORS: 'processing-errors'
  }
};