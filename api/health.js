module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    status: 'ok',
    service: 'VoiceShield Vercel API',
    websocket: false,
    version: '1.1.0'
  });
};
