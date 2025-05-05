const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');

const PROTO_PATH = __dirname + '/content_receiver.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const contentReceiverProto = grpc.loadPackageDefinition(packageDefinition).contentreceiver;

const kafka = new Kafka({
  clientId: 'content-receiver',
  brokers: ['localhost:9092']
});
const producer = kafka.producer();

async function processContent(call, callback) {
  try {
    await producer.connect();
    await producer.send({
      topic: 'incoming-medical-content',
      messages: [{ value: JSON.stringify(call.request) }],
    });
    callback(null, { status: "SUCCESS" });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

const server = new grpc.Server();
server.addService(contentReceiverProto.ContentReceiver.service, { ProcessContent: processContent });
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  server.start();
  console.log('gRPC server running on http://localhost:50051');
});