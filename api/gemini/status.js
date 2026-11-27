module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = (process.env.GEMINI_API_KEY || '').trim();
  return res.status(200).json({
    has_key: Boolean(key),
    masked_key: key.length > 8 ? `${key.slice(0, 6)}...${key.slice(-4)}` : (key ? 'Faol' : null)
  });
};
