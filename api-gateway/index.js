const path = require('path');
const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const {Partitioners } = require('kafkajs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { kafka, TOPICS } = require('../config/kafka-config');
const { GraphQLJSON } = require('graphql-type-json'); 
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration Kafka

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
      topic: TOPICS.INCOMING,
      messages: [{
        value: JSON.stringify({ text, metadata }),
        headers: {
          'source': 'api-gateway',
          'timestamp': new Date().toISOString()
        }
      }]
    });
    res.json({ message: "Content received", status: "SUCCESS" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GraphQL Setup
const typeDefs = gql`
  scalar JSON

  type MedicalContent {
    id: ID!
    text: String
    category: String
    timestamp: String
    metadata: JSON
  }

  type Query {
    contents: [MedicalContent!]!
  }
`;

const resolvers = {
    JSON: GraphQLJSON,
    Query: {
      contents: async () => {
        try {
          const response = await axios.get('http://localhost:8001/api/contents');
          return response.data.map(item => ({
            ...item,
            metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata
          }));
        } catch (error) {
          console.error('API call failed:', error.response?.data || error.message);
          throw new Error('Failed to fetch medical contents');
        }
      },
    },
  };

  async function startServer() {
    try {
      // Connect Kafka producer first
      await producer.connect();
      console.log('Kafka producer connected');
  
      // Then start Apollo Server
      const server = new ApolloServer({ typeDefs, resolvers });
      await server.start();
      server.applyMiddleware({ app });
      
      app.listen(8000, () => {
        console.log('API Gateway running on http://localhost:8000');
      });
    } catch (err) {
      console.error('Server startup error:', err);
      process.exit(1);
    }
  }
  
  startServer();