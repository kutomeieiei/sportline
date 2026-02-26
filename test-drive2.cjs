const https = require('https');

https.get('https://lh3.googleusercontent.com/d/1ATCNkuyDtZeq16R6ht19lVp28qjVRORU', (res) => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
