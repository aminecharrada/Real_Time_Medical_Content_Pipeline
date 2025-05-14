![image](https://github.com/user-attachments/assets/aea2dd97-7844-45fb-8365-bdd8cd248680)Très bien ! Voici une version **recréée et structurée proprement** de votre `README.md`, incluant un schéma Mermaid, des sections claires et professionnelles, tout en conservant l’esprit de votre message original.

---

# 🩺 Pipeline de Traitement de Contenu Médical

Ce projet met en œuvre un pipeline distribué pour ingérer, enrichir, stocker et interroger du contenu médical. Il s'appuie sur une architecture microservices, Kafka pour la communication asynchrone, MongoDB pour le stockage et LM Studio pour l’enrichissement par IA.

---

## 📑 Table des Matières

* [🚀 Aperçu du Projet](#-aperçu-du-projet)
* [✨ Fonctionnalités Clés](#-fonctionnalités-clés)
* [🧱 Architecture Globale](#-architecture-globale)

  * [📊 Diagramme Mermaid](#-diagramme-mermaid)
  * [🔁 Détail du Flux de Données](#-détail-du-flux-de-données)
* [🛠️ Technologies Utilisées](#-technologies-utilisées)
* [⚙️ Prérequis](#-prérequis)
* [📦 Installation](#-installation)
* [▶️ Lancement des Services](#️-lancement-des-services)
* [🔗 Points d'Accès API](#-points-daccès-api)
* [📁 Structure du Projet](#-structure-du-projet)
* [🧩 Améliorations Possibles](#-améliorations-possibles)

---

## 🚀 Aperçu du Projet

L'objectif est de construire un système **scalable** et **modulaire** pour traiter du texte médical. Les messages sont transmis entre microservices via **Apache Kafka**, enrichis par un modèle de langage (via **LM Studio**), stockés dans **MongoDB** et consultables via des API **REST** et **GraphQL**.

---

## ✨ Fonctionnalités Clés

✅ Ingestion via API REST ou gRPC

✅ Traitement asynchrone et découplé via Kafka

✅ Classification automatique par mots-clés

✅ Enrichissement intelligent via LM Studio

✅ Stockage durable dans MongoDB

✅ Accès flexible via GraphQL ou REST


---

## 🧱 Architecture Globale



```mermaid
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

```

---

## 🔁 Détail du Flux de Données

1. **Ingestion**

   * Un client envoie une requête `POST /api/content` (REST) ou appelle `ProcessContent` (gRPC).
   * Le message est publié sur `incoming-medical-content`.

2. **Classification & Enrichissement**

   * Le `Classifier Service` consomme les messages.
   * Classification simple basée sur mots-clés.
   * Envoi du texte à **LM Studio** pour résumé/analyse.
   * Résultat enrichi publié sur `classified-content`.

3. **Stockage**

   * Le `Storage Service` consomme le topic `classified-content`.
   * Les données sont enregistrées dans **MongoDB**.
   * Une API REST (`GET /api/contents`) permet la récupération.

4. **Consultation**

   * Via API Gateway (GraphQL) ou `Query Service`, les clients peuvent interroger les contenus.
   * Les resolvers appellent l’API REST du `Storage Service`.

---

## Tests et Démonstration du Fonctionnement


### Flux 1: Ingestion via API Gateway (REST) et Traitement Complet

1.  **Étape 1: Soumission du Contenu via API Gateway (REST)**
    *   **Action :** Envoyez une requête `POST` à `http://localhost:8000/api/content` avec un corps JSON.
        ```json
        {
          "text": "Le patient presente des symptomes de grippe fievre elevee et toux seche Antecedents de cardiopathie",
          "metadata": { "patient_id": "P001", "source": "Consultation Dr. Bernard" }
        }
        ```
    
    *   Logs de l'API Gateway indiquant la réception et la production du message vers Kafka.
    
        ![image](https://github.com/user-attachments/assets/518da8a8-efce-40b4-85ae-2efdd6ebbb0a)


        ```

2.  **Étape 2: Vérification du Message sur le Topic `incoming-medical-content`**
   
    ![image](https://github.com/user-attachments/assets/59855903-62d1-40e0-a181-ee3f35dc64d4)


4.  **Étape 3: Traitement par le Classifier Service et LM Studio**
       
    *   **Observations (Classifier Service Logs) :**
        
        
        
       
        
          ![image](https://github.com/user-attachments/assets/e4184476-7905-49f6-af52-c3dd1ad85ed0)
          ![image](https://github.com/user-attachments/assets/4a18d64a-d96e-4541-a824-68c001530238)
          ![image](https://github.com/user-attachments/assets/1110362c-ce52-47c6-a938-8e1606300e89)
          ![image](https://github.com/user-attachments/assets/9a40bc7c-56b3-48e6-bafe-0b6409be5d43)
          ![image](https://github.com/user-attachments/assets/7996240f-4014-4c17-9d4d-0dc159a2bd54)
          ![image](https://github.com/user-attachments/assets/e70dad62-7725-4323-8e8f-fa93fd8038f4)
          ![image](https://github.com/user-attachments/assets/15048ce4-db1d-4a40-8c62-da98e7a5a9f8)

          





    *   **Observations attendues (LM Studio Logs) :**
        ![image](https://github.com/user-attachments/assets/0bf46b03-1d55-4357-ab61-97e5aa77881b)
        ![image](https://github.com/user-attachments/assets/a7307f7f-563e-49df-84d0-a7091ef6722c)


5.  **Étape 4: Vérification du Message sur le Topic `classified-content`**

    ![image](https://github.com/user-attachments/assets/a6725fd0-7269-4d9c-afa6-a20416111a5d)
    

7.  **Étape 5: Stockage par le Storage Service**
    *   **Action :** Observez les logs du `Storage Service`.
   
          
        ![image](https://github.com/user-attachments/assets/04863f18-41c1-4db9-a0ce-8f27799582ea)


8.  **Étape 6: Vérification des Données dans MongoDB**
    *   **Action :**  MongoDB Capture.

        ![image](https://github.com/user-attachments/assets/9ee81511-7b19-4432-8c84-80948e48c0e4)


9.  **Étape 7: Consultation via l'API REST du Storage Service**
    *   **Action :** Envoyez une requête `GET` à `http://localhost:8001/api/contents`.
      
    ![image](https://github.com/user-attachments/assets/84c5eab3-da9d-4cfc-ba39-2bb2ec9b2ff7)

    

10.  **Étape 8: Consultation via GraphQL (API Gateway ou Query Service)**

     ![image](https://github.com/user-attachments/assets/369ee2d1-986a-400c-b953-bc1a25cc645c)

     ![image](https://github.com/user-attachments/assets/7e59e41d-a77b-4a0d-a550-7651591a8f41)
     

---

### Flux 2: Ingestion via Content Receiver Service (gRPC)

1.  **Étape 1: Soumission du Contenu via gRPC**
    *   **Action :** Utilisez un client gRPC pour appeler la méthode `ProcessContent` du service `ContentReceiver` sur `localhost:50051`.
        ![image](https://github.com/user-attachments/assets/f6d20639-5242-4d70-9c7a-78c933ea6842)
        ![image](https://github.com/user-attachments/assets/8625df55-4a94-4f3c-ac11-bf91605b6e8b)



2.  **Étape 2: Suite du Traitement**
    *   **Action :** Les étapes suivantes (vérification sur Kafka, traitement par Classifier, stockage, consultation) sont identiques aux étapes 2 à 8 du Flux 1.
    *   **Observations attendues :** Similaires au Flux 1, mais avec les données du message gRPC.
    *   **Captures d'écran suggérées :** Vous pouvez réutiliser les types de captures d'écran du Flux 1, mais avec les données issues de la soumission gRPC.

---

### Notes sur les Captures d'écran

*   Remplacez les commentaires `<!-- Insérez ici une capture d'écran ... -->` par de vraies images.
*   Utilisez des noms de fichiers descriptifs pour vos captures d'écran.
*   Assurez-vous que les captures sont claires et mettent en évidence l'information pertinente.
*   Vous pouvez les intégrer directement dans le README si votre plateforme le supporte (ex: GitHub) en utilisant la syntaxe Markdown : `![Texte alternatif](chemin/vers/votre_image.png)`

# ... (Section Améliorations Possibles et reste du README) ...
## 🛠️ Technologies Utilisées

| Composant          | Technologie                           |
| ------------------ | ------------------------------------- |
| Langage principal  | Node.js                               |
| Web/API Framework  | Express.js                            |
| API GraphQL        | Apollo Server                         |
| Base de données    | MongoDB + Mongoose                    |
| Bus de messages    | Apache Kafka + kafkajs                |
| IA / NLP           | LM Studio (local, modèle open-source) |
| gRPC Communication | `@grpc/grpc-js`, `@grpc/proto-loader` |
| HTTP Client        | Axios                                 |

---

## ⚙️ Prérequis

* Node.js v16+
* Apache Kafka & Zookeeper (localhost:9092)
* MongoDB (localhost:27017)
* LM Studio (localhost:1234)

  * Modèle chargé (ex : `deepseek-r1-distill-qwen-7b`)
  * Serveur API actif (ex : `/v1/chat/completions`)

---

## 📦 Installation

Clonez le dépôt :

```bash
git clone https://github.com/votre-utilisateur/medical-pipeline.git
cd medical-pipeline
```

Installez les dépendances :

```bash
cd api-gateway && npm install
cd ../classifier-service && npm install
cd ../content-receiver && npm install
cd ../storage-service && npm install
cd ../query-service && npm install
```

---

## ▶️ Lancement des Services

**Démarrage recommandé dans l’ordre suivant :**

1. Kafka + Zookeeper
2. MongoDB
3. LM Studio (modèle chargé, serveur API actif)
4. Microservices :

```bash
# Dans chaque dossier de service
npm run start
```

---

## 🔗 Points d'accès API

| Service         | Type         | Port  | URL/Entrée                 |
| --------------- | ------------ | ----- | -------------------------- |
| API Gateway     | REST/GraphQL | 8000  | `/api/content`, `/graphql` |
| gRPC Receiver   | gRPC         | 50051 | `ProcessContent()`         |
| Storage Service | REST         | 8001  | `/api/contents`            |
| Query Service   | GraphQL      | 4000  | `/graphql`                 |

---

## 📁 Structure du Projet (exemple)

```
medical-pipeline/
├── api-gateway/
├── classifier-service/
├── content-receiver/
├── query-service/
├── storage-service/
├── config/
│   └── kafka-config.js
└── README.md
```

---

## 🧩 Améliorations Possibles

* Ajout de mécanismes de retry / gestion d’erreurs (topic `processing-errors`)
* Authentification / sécurisation des API
* Monitoring (ex: Prometheus + Grafana)
* CI/CD pour déploiement multi-environnement
* Interface Web de visualisation (ex: Next.js + Apollo Client)

---

Souhaitez-vous que je génère ce README sous forme de fichier `.md` ?
