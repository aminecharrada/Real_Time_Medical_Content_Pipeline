
# Medical Content Processing Pipeline

## Architecture Overview

graph TD
    %% Clients externes
    ClientREST[Client Ingestion REST]
    ClientGRPC[Client Ingestion gRPC]
    ClientGraphQL[Client Requête GraphQL]

    %% Points d'entrée & requêtes
    APIGW["API Gateway<br>(localhost:8000)<br>Express, Apollo Server"]
    GRPCReceiver["Content Receiver<br>(localhost:50051)<br>gRPC Server"]
    GraphQLQuery["Query Service<br>(localhost:4000)<br>Apollo Server"]

    %% Kafka Topics
    TopicIncoming["Topic:<br>incoming-medical-content"]
    TopicClassified["Topic:<br>classified-content"]

    %% Traitement
    Classifier["Classifier Service<br>Kafka Consumer/Producer"]
    LMStudio[(LM Studio Externe)]

    %% Stockage
    Storage["Storage Service<br>(localhost:8001)<br>Express, Mongoose, Kafka Consumer"]
    Mongo[(MongoDB)]

    %% Ingestion Flow
    ClientREST -->|"POST /api/content"| APIGW
    APIGW -->|"Produit msg"| TopicIncoming

    ClientGRPC -->|"ProcessContent"| GRPCReceiver
    GRPCReceiver -->|"Produit msg"| TopicIncoming

    %% Traitement Flow
    Classifier -->|"Consomme"| TopicIncoming
    Classifier -->|"Appel HTTP POST"| LMStudio
    LMStudio -->|"Texte enrichi"| Classifier
    Classifier -->|"Produit msg classifié"| TopicClassified

    %% Stockage Flow
    Storage -->|"Consomme"| TopicClassified
    Storage -->|"Stocke/Lit"| Mongo

    %% Requête Flow
    ClientGraphQL -->|"Requête GraphQL /graphql"| APIGW
    APIGW -->|"Resolver appelle GET /api/contents"| Storage

    ClientGraphQL -->|"Requête GraphQL /graphql"| GraphQLQuery
    GraphQLQuery -->|"Resolver appelle GET /api/contents"| Storage

    %% Classes
    classDef service fill:#D6EAF8,stroke:#2980B9,stroke-width:2px,color:#000;
    class APIGW,GRPCReceiver,GraphQLQuery,Classifier,Storage service;

    classDef topic fill:#FDEBD0,stroke:#E67E22,stroke-width:2px,color:#000;
    class TopicIncoming,TopicClassified topic;

    classDef db fill:#D5F5E3,stroke:#27AE60,stroke-width:2px,color:#000;
    class Mongo db;

    classDef external fill:#FCF3CF,stroke:#F1C40F,stroke-width:2px,color:#000;
    class LMStudio external;

    classDef client fill:#EAEDED,stroke:#7F8C8D,stroke-width:2px,color:#000;
    class ClientREST,ClientGRPC,ClientGraphQL client;





## Core Components

### 1. API Gateway (Port 8000)
- **Entry Point**: REST & GraphQL endpoints
- **Responsibilities**:
  - Request validation
  - Protocol translation
  - Kafka message production
- **Tech**: Express.js, Apollo Server

### 2. Content Receiver (gRPC, Port 50051)
- **Protocol**: gRPC
- **Responsibilities**:
  - Receive medical content
  - Publish to Kafka
- **Tech**: gRPC, KafkaJS

### 3. Classifier Service
- **Input**: Kafka messages
- **Processing**:
  - Keyword-based classification
  - LLM enhancement via LM Studio
- **Output**: Kafka messages with enriched content
- **Tech**: KafkaJS, Axios

### 4. Storage Service (Port 8001)
- **Database**: MongoDB
- **Responsibilities**:
  - Content persistence
  - REST API for data retrieval
- **Tech**: Express.js, Mongoose

### 5. Query Service (GraphQL, Port 4000)
- **Interface**: GraphQL
- **Features**:
  - Flexible queries
  - Category filtering
- **Tech**: Apollo Server

## Data Flow

1. **Ingestion**:
   - Clients submit content via REST or gRPC
   - Messages published to Kafka `incoming-medical-content` topic

2. **Processing**:
   - Classifier consumes messages
   - Applies medical categorization
   - Enhances with LM Studio
   - Publishes to `classified-content` topic

3. **Storage**:
   - Storage service persists to MongoDB
   - Adds timestamps and metadata

4. **Querying**:
   - Clients query via GraphQL or REST
   - Results returned with full context

## Getting Started

### Prerequisites
- Node.js 16+
- MongoDB
- Kafka
- LM Studio (optional)

### Installation
```bash
git clone https://github.com/your-repo/medical-pipeline.git
cd medical-pipeline
npm install
```

### Configuration
Edit `config/kafka-config.js`:
```javascript
module.exports = {
  kafka: {
    brokers: ['localhost:9092']
  },
  TOPICS: {
    INCOMING: 'incoming-medical-content',
    CLASSIFIED: 'classified-content'
  }
}
```

### Running Services
```bash
# Start API Gateway
cd api-gateway
npm start

# Start Content Receiver
cd content-receiver
npm start

# Start Classifier
cd classifier-service
npm start

# Start Storage Service
cd storage-service
npm start

# Start Query Service
cd query-service
npm start
```

## API Documentation

### REST Endpoints
`POST /api/content`
```json
{
  "text": "Patient symptoms...",
  "metadata": {}
}
```

### GraphQL Queries
```graphql
{
  contents {
    id
    text
    category
    lm_enhancement
  }
  
  contentsByCategory(category: "cardiology") {
    id
    text
  }
}
```

## Monitoring
View Kafka messages:
```bash
# Incoming content
kafka-console-consumer --bootstrap-server localhost:9092 --topic incoming-medical-content

# Classified content
kafka-console-consumer --bootstrap-server localhost:9092 --topic classified-content
```

## License
MIT License - See LICENSE.md for details
``` 
