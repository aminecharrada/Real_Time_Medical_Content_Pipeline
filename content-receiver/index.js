const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const {Partitioners } = require('kafkajs');
const PROTO_PATH = __dirname + '/content_receiver.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const contentReceiverProto = grpc.loadPackageDefinition(packageDefinition).contentreceiver;
const { kafka, TOPICS } = require('../config/kafka-config');

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner 
});
async function processContent(call, callback) {
  try {
    await producer.connect();
    await producer.send({
      topic: TOPICS.INCOMING,
      messages: [{
        value: JSON.stringify(call.request),
        headers: {
          'source': 'content-receiver',
          'timestamp': new Date().toISOString()
        }
      }]
    });
    callback(null, { status: "SUCCESS" });
  } catch (err) {
    callback({ 
      code: grpc.status.INTERNAL, 
      message: err.message 
    });
  }
}

const server = new grpc.Server();
server.addService(contentReceiverProto.ContentReceiver.service, { ProcessContent: processContent });
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {  
  console.log('gRPC server running on http://localhost:50051');
});