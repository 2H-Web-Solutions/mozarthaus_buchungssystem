
export default async function handler(req: any, res: any) {
  // Regiondo validation handshake (responds to simple GET or POST)
  console.log('--- Regiondo Webhook Triggered ---');
  console.log('Method:', req.method);
  console.log('Timestamp:', new Date().toISOString());

  if (req.method === 'POST' && req.body) {
    console.log('--- Payload Received ---');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('------------------------');
  } else if (req.method === 'GET') {
    console.log('--- Handshake / Health Check Received ---');
  }

  // Always return 200 OK so Regiondo doesn't report "Webhook does not answer"
  return res.status(200).json({ 
    received: true, 
    message: 'Mozarthaus Webhook is Active' 
  });
}
