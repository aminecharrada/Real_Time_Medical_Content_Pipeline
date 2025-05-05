const path = require('path');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { Kafka, Partitioners } = require('kafkajs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Configuration Kafka
const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: ['localhost:9092']
});
const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});

// Configuration gRPC
const PROTO_PATH = path.join(__dirname, '../content-receiver/content_receiver.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const contentReceiver = protoDescriptor.contentreceiver;

const client = new contentReceiver.ContentReceiver(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// REST Endpoint
app.post('/api/content', async (req, res) => {
  try {
    const { text, metadata } = req.body;
    await producer.connect();
    await producer.send({
      topic: 'incoming-medical-content',
      messages: [{ value: JSON.stringify({ text, metadata }) }],
    });
    res.json({ message: "Content received", status: "SUCCESS" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GraphQL Setup
const typeDefs = `
  type MedicalContent {
    id: ID!
    text: String!
    category: String!
    timestamp: String!
  }

  type Query {
    contents: [MedicalContent!]!
  }
`;

const resolvers = {
  Query: {
    contents: async () => {
      const response = await fetch('http://localhost:8001/api/contents');
      return response.json();
    },
  },
};

async function startServer() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app });
  
  app.listen(8000, () => {
    console.log('API Gateway running on http://localhost:8000');
  });
}

startServer().catch(err => console.error(err));