const { ApolloServer, gql } = require('apollo-server');
const axios = require('axios'); 

const typeDefs = gql`
  type MedicalContent {
    id: ID!
    text: String!
    category: String!
    timestamp: String!
    metadata: JSON
    lm_enhancement: String
  }

  scalar JSON

  type Query {
    contents: [MedicalContent!]!
    contentsByCategory(category: String!): [MedicalContent!]!
  }
`;

const resolvers = {
  JSON: require('graphql-type-json'), 
  Query: {
    contents: async () => {
      try {
        const response = await axios.get('http://localhost:8001/api/contents');
        return response.data.map(item => ({
          id: item._id || item.id,
          text: item.text || "",
          category: item.category || "uncategorized",
          timestamp: item.timestamp || new Date().toISOString(),
          metadata: item.metadata || {},
          lm_enhancement: item.lm_enhancement || "Not available"
        }));
      } catch (error) {
        console.error('Failed to fetch contents:', error.message);
        throw new Error('Failed to retrieve medical contents');
      }
    },
    contentsByCategory: async (_, { category }) => {
      const response = await axios.get('http://localhost:8001/api/contents');
      return response.data
        .filter(c => c.category === category)
        .map(item => ({
          id: item._id || item.id,
          text: item.text || "",
          category: item.category || "uncategorized",
          timestamp: item.timestamp || new Date().toISOString(),
          metadata: item.metadata || {},
          lm_enhancement: item.lm_enhancement || "Not available"
        }));
    }
  }
};

const server = new ApolloServer({ 
  typeDefs, 
  resolvers,
  introspection: true,
  playground: true
});

server.listen(4000).then(({ url }) => {
  console.log(`🚀 Query Service ready at ${url}`);
});