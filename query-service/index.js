const { ApolloServer } = require('apollo-server');
const fetch = require('node-fetch');

const typeDefs = `
  type MedicalContent {
    id: ID!
    text: String!
    category: String!
    timestamp: String!
  }

  type Query {
    contents: [MedicalContent!]!
    contentsByCategory(category: String!): [MedicalContent!]!
  }
`;

const resolvers = {
  Query: {
    contents: async () => {
      const response = await fetch('http://localhost:8001/api/contents');
      return response.json();
    },
    contentsByCategory: async (_, { category }) => {
      const response = await fetch(`http://localhost:8001/api/contents`);
      const allContents = await response.json();
      return allContents.filter(c => c.category === category);
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
server.listen(4000).then(({ url }) => {
  console.log(`Query Service ready at ${url}`);
});