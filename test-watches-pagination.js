const http = require('http');

// Test the watches endpoint to check pagination response format
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/watches?page=1&limit=5',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Headers:', res.headers);
    console.log('Response Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      // Check if the response has the expected pagination structure
      if (parsed.data && parsed.pagination) {
        console.log('\n✅ Pagination response format is correct!');
        console.log('Data array length:', parsed.data.length);
        console.log('Pagination object:', parsed.pagination);
      } else {
        console.log('\n❌ Pagination response format is incorrect!');
        console.log('Expected: { data: [...], pagination: {...} }');
        console.log('Received:', Object.keys(parsed));
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
